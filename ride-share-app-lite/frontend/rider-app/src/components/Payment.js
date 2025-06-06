import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Box, Button, Typography } from '@mui/material';
import axios from 'axios';

const stripePromise = loadStripe('your_publishable_key');

const PaymentForm = ({ amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [clientSecret, setClientSecret] = useState('');
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientSecret = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No token found in localStorage');
        console.log('Fetching client secret with token:', token);
        const response = await axios.post(
          'http://localhost:5000/api/payments/create-payment-intent',
          { amount },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('Client secret response:', response.data);
        setClientSecret(response.data.clientSecret);
      } catch (error) {
        console.error('Payment initialization error:', error);
        setPaymentError(error.response?.data?.error || error.message || 'Failed to initialize payment');
      } finally {
        setLoading(false);
      }
    };
    fetchClientSecret();
  }, [amount]);

  useEffect(() => {
    console.log('Stripe loaded:', !!stripe);
    console.log('Elements loaded:', !!elements);
    console.log('Client secret:', clientSecret);
  }, [stripe, elements, clientSecret]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || !clientSecret) {
      setPaymentError('Stripe not loaded or client secret missing');
      console.error('Stripe:', stripe, 'Elements:', elements, 'ClientSecret:', clientSecret);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement),
      },
    });

    if (error) {
      setPaymentError(error.message);
      setPaymentSuccess(false);
    } else if (paymentIntent.status === 'succeeded') {
      setPaymentSuccess(true);
      setPaymentError(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, margin: 'auto', mt: 5 }}>
      <h2>Payment</h2>
      <Typography variant="h6">Amount: ${amount / 100}</Typography>
      {loading ? (
        <Typography>Loading payment...</Typography>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={!stripe || !clientSecret}>
            Pay
          </Button>
        </form>
      )}
      {paymentError && <Typography color="error">{paymentError}</Typography>}
      {paymentSuccess && <Typography color="success">Payment successful!</Typography>}
    </Box>
  );
};

const Payment = ({ amount }) => (
  <Elements stripe={stripePromise}>
    <PaymentForm amount={amount} />
  </Elements>
);

export default Payment;
