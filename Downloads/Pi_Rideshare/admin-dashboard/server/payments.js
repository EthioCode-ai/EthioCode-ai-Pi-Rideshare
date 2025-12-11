const { db } = require('./database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_...');

// Payment service for handling Stripe operations
const paymentService = {
  async createCustomer(email, name, phone) {
    try {
      return await stripe.customers.create({
        email,
        name,
        phone,
        metadata: { platform: 'rideshare' }
      });
    } catch (error) {
      console.error('Stripe createCustomer error:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  },

  async createSetupIntent(customerId, paymentMethodTypes = ['card']) {
    try {
      return await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: paymentMethodTypes,
        usage: 'off_session'
      });
    } catch (error) {
      console.error('Stripe createSetupIntent error:', error);
      throw new Error(`Failed to create setup intent: ${error.message}`);
    }
  },

  async createSetupIntentForWallet(customerId, walletType) {
    const paymentMethodTypes = [];
    
    switch (walletType) {
      case 'apple_pay':
        paymentMethodTypes.push('card'); // Apple Pay uses card tokens
        break;
      case 'google_pay':
        paymentMethodTypes.push('card'); // Google Pay uses card tokens
        break;
      default:
        paymentMethodTypes.push('card');
    }

    try {
      return await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: paymentMethodTypes,
        usage: 'off_session',
        metadata: { wallet_type: walletType }
      });
    } catch (error) {
      console.error('Stripe createSetupIntentForWallet error:', error);
      throw new Error(`Failed to create wallet setup intent: ${error.message}`);
    }
  },

  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      return await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    } catch (error) {
      console.error('Stripe attachPaymentMethod error:', error);
      throw new Error(`Failed to attach payment method: ${error.message}`);
    }
  },

  async getCustomerPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        brand: pm.card.brand,
        last4: pm.card.last4,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year
      }));
    } catch (error) {
      console.error('Stripe getCustomerPaymentMethods error:', error);
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }
  },

  async processRidePayment(rideId, paymentMethodId, amount, customerId, driverId) {
    try {
      const amountCents = Math.round(amount * 100);
      const platformFee = Math.round(amountCents * 0.25); // 25% platform fee
      const driverEarnings = amountCents - platformFee;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        return_url: process.env.FRONTEND_URL || 'https://your-repl-name.replit.app',
        metadata: {
          rideId,
          driverId,
          type: 'ride_payment'
        }
      });

      return {
        paymentIntent,
        driverEarnings: driverEarnings / 100,
        platformFee: platformFee / 100
      };
    } catch (error) {
      console.error('Stripe processRidePayment error:', error);
      throw new Error(`Failed to process ride payment: ${error.message}`);
    }
  },

  async processTip(rideId, driverId, customerId, paymentMethodId, tipAmount) {
    try {
      const amountCents = Math.round(tipAmount * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        return_url: process.env.FRONTEND_URL || 'https://your-repl-name.replit.app',
        metadata: {
          rideId,
          driverId,
          type: 'tip'
        },
        description: `Tip for ride ${rideId}`,
        application_fee_amount: Math.round(amountCents * 0.03) // 3% platform fee on tips
      });

      // Create transfer to driver (in production)
      if (process.env.NODE_ENV === 'production') {
        await this.createDriverTransfer(driverId, amountCents * 0.97, `Tip for ride ${rideId}`);
      }

      return { paymentIntent };
    } catch (error) {
      console.error('Stripe processTip error:', error);
      throw new Error(`Failed to process tip: ${error.message}`);
    }
  },

  async createDriverTransfer(driverId, amount, description) {
    // Get driver's Stripe account (this would be set up during driver onboarding)
    const driver = await db.getUserById(driverId);
    
    if (driver.stripe_account_id) {
      try {
        return await stripe.transfers.create({
          amount: Math.round(amount),
          currency: 'usd',
          destination: driver.stripe_account_id,
          description
        });
      } catch (error) {
        console.error('Stripe transfer error:', error);
        throw new Error(`Failed to create transfer: ${error.message}`);
      }
    } else {
      // Store pending transfer for manual processing
      await db.query(
        `INSERT INTO pending_transfers (driver_id, amount, description, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [driverId, amount / 100, description]
      );
    }
  },

  async processRefund(paymentIntentId, amount, reason) {
    try {
      const amountCents = amount ? Math.round(amount * 100) : undefined;

      return await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason: reason || 'requested_by_customer'
      });
    } catch (error) {
      console.error('Stripe processRefund error:', error);
      throw new Error(`Failed to process refund: ${error.message}`);
    }
  },

  async handleWebhook(event) {
    const { data, type } = event;
    const paymentIntent = data.object;

    switch (type) {
      case 'payment_intent.succeeded':
        console.log('💳 Payment succeeded:', paymentIntent.id);
        await this.handlePaymentSuccess(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        console.log('❌ Payment failed:', paymentIntent.id);
        await this.handlePaymentFailure(paymentIntent);
        break;

      case 'payment_intent.requires_action':
        console.log('🔐 Payment requires action:', paymentIntent.id);
        await this.handlePaymentAction(paymentIntent);
        break;

      case 'payment_method.attached':
        console.log('💳 Payment method attached:', data.object.id);
        await this.handlePaymentMethodAttached(data.object);
        break;

      case 'setup_intent.succeeded':
        console.log('✅ Setup intent succeeded:', data.object.id);
        await this.handleSetupIntentSuccess(data.object);
        break;

      case 'invoice.payment_succeeded':
        console.log('📄 Invoice payment succeeded:', data.object.id);
        break;

      case 'customer.subscription.created':
        console.log('📋 Subscription created:', data.object.id);
        break;

      default:
        console.log('📝 Unhandled webhook event:', type);
    }
  },

  async handlePaymentSuccess(paymentIntent) {
    const { metadata } = paymentIntent;
    const { rideId, type, driverId } = metadata;

    // Record successful payment
    await db.query(
      `INSERT INTO payment_transactions (ride_id, stripe_payment_intent_id, amount, currency, status, transaction_type, net_amount, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        rideId,
        paymentIntent.id,
        paymentIntent.amount / 100,
        paymentIntent.currency,
        'succeeded',
        type || 'fare',
        (paymentIntent.amount / 100) * 0.971 // After Stripe fees
      ]
    );

    if (type === 'fare') {
      // Update ride payment status
      await db.query(
        'UPDATE rides SET payment_status = $1, payment_intent_id = $2, paid_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['paid', paymentIntent.id, rideId]
      );

      // Calculate and record driver earnings
      const platformFeePercentage = 0.25; // 25% platform fee
      const driverEarnings = (paymentIntent.amount / 100) * (1 - platformFeePercentage);

      await db.query(
        `INSERT INTO driver_earnings (driver_id, ride_id, base_fare, platform_fee, net_earnings, earning_type, created_at)
         VALUES ($1, $2, $3, $4, $5, 'ride_completion', CURRENT_TIMESTAMP)`,
        [
          driverId,
          rideId,
          paymentIntent.amount / 100,
          (paymentIntent.amount / 100) * platformFeePercentage,
          driverEarnings
        ]
      );

      console.log(`💰 Driver earnings recorded: $${driverEarnings.toFixed(2)} for ride ${rideId}`);
    }

    // Notify relevant parties
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (ride.rows[0]) {
      const rideData = ride.rows[0];
      
      io.to(`user-${rideData.rider_id}`).emit('payment-confirmed', {
        rideId,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        type
      });

      if (driverId) {
        io.to(`user-${driverId}`).emit('payment-confirmed', {
          rideId,
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          type
        });
      }
    }
  },

  async handlePaymentFailure(paymentIntent) {
    const { metadata } = paymentIntent;
    const { rideId, type } = metadata;

    // Record failed payment
    await db.query(
      `INSERT INTO payment_transactions (ride_id, stripe_payment_intent_id, amount, currency, status, transaction_type, error_code, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        rideId,
        paymentIntent.id,
        paymentIntent.amount / 100,
        paymentIntent.currency,
        'failed',
        type || 'fare',
        paymentIntent.last_payment_error?.code || 'unknown_error'
      ]
    );

    // Update ride status
    if (type === 'fare') {
      await db.query(
        'UPDATE rides SET payment_status = $1, payment_error = $2 WHERE id = $3',
        ['failed', paymentIntent.last_payment_error?.message || 'Payment failed', rideId]
      );
    }

    // Notify rider of payment failure
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (ride.rows[0]) {
      io.to(`user-${ride.rows[0].rider_id}`).emit('payment-failed', {
        rideId,
        paymentIntentId: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message || 'Payment failed',
        errorCode: paymentIntent.last_payment_error?.code || 'unknown_error',
        type
      });
    }
  },

  async handlePaymentAction(paymentIntent) {
    const { metadata } = paymentIntent;
    const { rideId } = metadata;

    // Notify rider that additional action is required
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (ride.rows[0]) {
      io.to(`user-${ride.rows[0].rider_id}`).emit('payment-action-required', {
        rideId,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        message: 'Additional verification required for your payment method'
      });
    }
  },

  async handlePaymentMethodAttached(paymentMethod) {
    console.log('💳 Payment method attached to customer:', paymentMethod.customer);
    
    try {
      // Update payment method in database if needed
      const customer = await stripe.customers.retrieve(paymentMethod.customer);
      if (customer.metadata.user_id) {
        await db.query(
          `UPDATE payment_methods SET attached_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1 AND stripe_pm_id = $2`,
          [customer.metadata.user_id, paymentMethod.id]
        );
      }
    } catch (error) {
      console.error('Error handling payment method attached:', error);
      // Don't throw here as this is a webhook handler
    }
  },

  async handleSetupIntentSuccess(setupIntent) {
    console.log('✅ Setup intent succeeded:', setupIntent.id);
    
    if (setupIntent.payment_method && setupIntent.customer) {
      // Automatically attach the payment method
      await this.attachPaymentMethod(setupIntent.payment_method, setupIntent.customer);
    }
  }
};

module.exports = paymentService;