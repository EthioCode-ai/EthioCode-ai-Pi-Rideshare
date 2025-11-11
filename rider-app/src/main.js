
// Enhanced Rider App with Advanced Features
class RiderApp {
  constructor() {
    this.currentLocation = null;
    this.map = null;
    this.directionsService = null;
    this.directionsRenderer = null;
    this.pickupMarker = null;
    this.destinationMarker = null;
    this.driverMarkers = [];
    this.currentStep = 'location'; // location, destination, booking, ride-active, ride-complete
    this.rideData = null;
    this.rideHistory = [];
    this.currentRide = null;
    this.notifications = [];
    this.isTracking = false;
    this.driverLocation = null;
    
    this.init();
  }

  init() {
    this.renderApp();
    this.requestLocation();
    this.simulateNearbyDrivers();
    this.startNotificationSystem();
    this.initializeRealTimeTracking();
    this.loadRideHistory();
  }

  renderApp() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="mobile-container">
        <!-- Header -->
        <div class="header">
          <div class="location-bar">
            <div class="location-icon animated-pulse">📍</div>
            <div class="location-text">
              <div class="current-location">Locating you...</div>
              <div class="location-subtext">Tap to change pickup location</div>
            </div>
            <div class="header-actions">
              <button class="notification-btn" id="notificationBtn">
                🔔
                <span class="notification-badge" id="notificationBadge">3</span>
              </button>
              <div class="profile-btn" id="profileBtn">👤</div>
            </div>
          </div>
        </div>

        <!-- Map Container -->
        <div id="map" class="map-container">
          <div class="map-overlay">
            <button class="current-location-btn" id="currentLocationBtn">🎯</button>
            <div class="ride-timer" id="rideTimer" style="display: none;">
              <div class="timer-text">Ride Time</div>
              <div class="timer-value">00:00</div>
            </div>
          </div>
        </div>

        <!-- Weather Widget -->
        <div class="weather-widget" id="weatherWidget">
          <div class="weather-icon">☀️</div>
          <div class="weather-info">
            <div class="weather-temp">72°F</div>
            <div class="weather-desc">Sunny</div>
          </div>
        </div>

        <!-- Bottom Panel -->
        <div class="bottom-panel slide-up" id="bottomPanel">
          ${this.renderBottomContent()}
        </div>

        <!-- Ride Status Overlay -->
        <div class="ride-status" id="rideStatus" style="display: none;">
          ${this.renderRideStatus()}
        </div>

        <!-- Notifications Panel -->
        <div class="notifications-panel" id="notificationsPanel" style="display: none;">
          <div class="notifications-header">
            <h3>Notifications</h3>
            <button class="close-notifications" id="closeNotifications">×</button>
          </div>
          <div class="notifications-list" id="notificationsList">
            ${this.renderNotifications()}
          </div>
        </div>

        <!-- Profile Panel -->
        <div class="profile-panel" id="profilePanel" style="display: none;">
          <div class="profile-header">
            <div class="profile-avatar">👤</div>
            <div class="profile-info">
              <div class="profile-name">John Rider</div>
              <div class="profile-rating">⭐ 4.8 • Gold Member</div>
            </div>
            <button class="close-profile" id="closeProfile">×</button>
          </div>
          <div class="profile-content">
            <div class="profile-stats">
              <div class="stat-item">
                <div class="stat-value">${this.rideHistory.length}</div>
                <div class="stat-label">Total Rides</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">$247</div>
                <div class="stat-label">This Month</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">4.8</div>
                <div class="stat-label">Rating</div>
              </div>
            </div>
            <div class="profile-menu">
              <div class="menu-item" onclick="this.showRideHistory()">
                <div class="menu-icon">📋</div>
                <div class="menu-text">Ride History</div>
              </div>
              <div class="menu-item">
                <div class="menu-icon">💳</div>
                <div class="menu-text">Payment Methods</div>
              </div>
              <div class="menu-item">
                <div class="menu-icon">⚙️</div>
                <div class="menu-text">Settings</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading Overlay -->
        <div class="loading-overlay" id="loadingOverlay" style="display: none;">
          <div class="loading-spinner"></div>
          <div class="loading-text">Finding your ride...</div>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.initializeMap();
  }

  renderBottomContent() {
    switch(this.currentStep) {
      case 'location':
        return `
          <div class="location-setup fade-in">
            <div class="panel-header">
              <h2>Where to?</h2>
              <div class="search-suggestions" id="searchSuggestions">
                <div class="suggestion-chip">🏠 Home</div>
                <div class="suggestion-chip">💼 Work</div>
                <div class="suggestion-chip">✈️ Airport</div>
              </div>
            </div>
            <div class="search-container">
              <div class="search-input-wrapper">
                <input type="text" id="destinationInput" placeholder="Enter destination or search nearby" class="destination-input">
                <button id="searchBtn" class="search-btn">🔍</button>
              </div>
              <div class="voice-search-btn" id="voiceSearchBtn">🎤</div>
            </div>
            
            <div class="recent-destinations" id="recentDestinations">
              <h4>Recent destinations</h4>
              <div class="destination-list">
                <div class="destination-item">
                  <div class="destination-icon">📍</div>
                  <div class="destination-info">
                    <div class="destination-name">Starbucks Coffee</div>
                    <div class="destination-address">123 Main St</div>
                  </div>
                  <div class="destination-distance">0.3 mi</div>
                </div>
                <div class="destination-item">
                  <div class="destination-icon">🏢</div>
                  <div class="destination-info">
                    <div class="destination-name">Downtown Office</div>
                    <div class="destination-address">456 Business Ave</div>
                  </div>
                  <div class="destination-distance">1.2 mi</div>
                </div>
              </div>
            </div>
          </div>
        `;
      case 'booking':
        return `
          <div class="booking-panel slide-up">
            <div class="route-summary">
              <div class="route-info-header">
                <div class="route-time">
                  <span class="time-value">12</span>
                  <span class="time-unit">min</span>
                </div>
                <div class="route-details">
                  <div class="distance">3.2 mi</div>
                  <div class="traffic-status">Light traffic</div>
                </div>
                <div class="route-price">
                  <span class="price-value">$12.50</span>
                </div>
              </div>
            </div>
            
            <div class="ride-options-container">
              <h3>Choose your ride</h3>
              <div class="ride-options">
                <div class="ride-option selected premium-option" data-type="economy">
                  <div class="option-content">
                    <div class="option-icon">🚗</div>
                    <div class="option-info">
                      <div class="option-name">RideShare</div>
                      <div class="option-features">Affordable • 4 seats</div>
                      <div class="option-time">
                        <span class="eta-dot"></span>
                        2 min away
                      </div>
                    </div>
                    <div class="option-pricing">
                      <div class="option-price">$12.50</div>
                      <div class="price-breakdown">Base + time + distance</div>
                    </div>
                  </div>
                </div>
                
                <div class="ride-option premium-option" data-type="premium">
                  <div class="option-content">
                    <div class="option-icon">🚙</div>
                    <div class="option-info">
                      <div class="option-name">Premium</div>
                      <div class="option-features">Luxury • High-end cars</div>
                      <div class="option-time">
                        <span class="eta-dot"></span>
                        4 min away
                      </div>
                    </div>
                    <div class="option-pricing">
                      <div class="option-price">$18.75</div>
                      <div class="price-breakdown">Premium experience</div>
                    </div>
                  </div>
                </div>
                
                <div class="ride-option premium-option" data-type="xl">
                  <div class="option-content">
                    <div class="option-icon">🚐</div>
                    <div class="option-info">
                      <div class="option-name">RideXL</div>
                      <div class="option-features">6+ passengers • Extra space</div>
                      <div class="option-time">
                        <span class="eta-dot"></span>
                        6 min away
                      </div>
                    </div>
                    <div class="option-pricing">
                      <div class="option-price">$22.00</div>
                      <div class="price-breakdown">Group travel</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="booking-footer">
              <div class="payment-section">
                <div class="payment-method">
                  <div class="payment-icon">💳</div>
                  <div class="payment-info">
                    <div class="payment-name">Visa ****4567</div>
                    <div class="payment-default">Default payment</div>
                  </div>
                  <button class="change-payment">Change</button>
                </div>
              </div>
              <button id="bookRideBtn" class="book-ride-btn premium-btn">
                <span class="btn-text">Request RideShare</span>
                <span class="btn-loader" style="display: none;">
                  <div class="spinner-small"></div>
                </span>
              </button>
            </div>
          </div>
        `;
      case 'ride-complete':
        return `
          <div class="ride-complete-panel slide-up">
            <div class="complete-header">
              <div class="complete-icon">✅</div>
              <h2>Trip completed!</h2>
              <p>Hope you enjoyed your ride</p>
            </div>
            
            <div class="trip-summary">
              <div class="summary-item">
                <div class="summary-label">Total fare</div>
                <div class="summary-value">$12.50</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Trip time</div>
                <div class="summary-value">14 min</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Distance</div>
                <div class="summary-value">3.2 mi</div>
              </div>
            </div>

            <div class="driver-rating">
              <h3>Rate your driver</h3>
              <div class="driver-info-small">
                <div class="driver-avatar-small">🚗</div>
                <div class="driver-name">John Driver</div>
              </div>
              <div class="rating-stars">
                <span class="star" data-rating="1">⭐</span>
                <span class="star" data-rating="2">⭐</span>
                <span class="star" data-rating="3">⭐</span>
                <span class="star" data-rating="4">⭐</span>
                <span class="star" data-rating="5">⭐</span>
              </div>
            </div>

            <div class="trip-actions">
              <button class="receipt-btn">📧 Email receipt</button>
              <button class="new-ride-btn" onclick="this.startNewRide()">🚗 Book another ride</button>
            </div>
          </div>
        `;
      default:
        return '';
    }
  }

  renderRideStatus() {
    if (!this.currentRide) return '';
    
    return `
      <div class="ride-status-content">
        <div class="status-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${this.currentRide.progress}%"></div>
          </div>
        </div>

        <div class="driver-card">
          <div class="driver-info">
            <div class="driver-avatar-large">
              <img src="https://ui-avatars.com/api/?name=John+Driver&background=3b82f6&color=fff" alt="Driver" />
            </div>
            <div class="driver-details">
              <div class="driver-name">John Driver</div>
              <div class="driver-rating">⭐ 4.9 • 1,247 trips</div>
              <div class="vehicle-info">Honda Civic • ABC 123</div>
            </div>
            <div class="driver-actions">
              <button class="action-btn call-btn">📞</button>
              <button class="action-btn message-btn">💬</button>
            </div>
          </div>
        </div>

        <div class="ride-progress-status">
          <div class="status-step ${this.currentRide.step >= 1 ? 'completed' : 'active'}">
            <div class="step-icon">${this.currentRide.step >= 1 ? '✅' : '🚗'}</div>
            <div class="step-content">
              <div class="step-title">${this.currentRide.step >= 1 ? 'Driver found' : 'Finding driver'}</div>
              <div class="step-time">${this.currentRide.step >= 1 ? 'Found in 8 seconds' : 'Searching...'}</div>
            </div>
          </div>
          
          <div class="status-step ${this.currentRide.step >= 2 ? 'completed' : this.currentRide.step === 1 ? 'active' : ''}">
            <div class="step-icon">${this.currentRide.step >= 2 ? '✅' : '📍'}</div>
            <div class="step-content">
              <div class="step-title">${this.currentRide.step >= 2 ? 'Driver arrived' : 'Driver en route'}</div>
              <div class="step-time">${this.currentRide.step >= 2 ? 'Waiting for you' : '2 min away'}</div>
            </div>
          </div>

          <div class="status-step ${this.currentRide.step >= 3 ? 'active' : ''}">
            <div class="step-icon">🎯</div>
            <div class="step-content">
              <div class="step-title">On your way</div>
              <div class="step-time">12 min to destination</div>
            </div>
          </div>
        </div>

        <div class="live-tracking" ${this.currentRide.step >= 3 ? '' : 'style="display: none;"'}>
          <div class="tracking-info">
            <div class="speed-info">
              <div class="speed-value">35</div>
              <div class="speed-unit">mph</div>
            </div>
            <div class="eta-info">
              <div class="eta-label">Arriving in</div>
              <div class="eta-value">12 min</div>
            </div>
          </div>
        </div>

        <button class="cancel-ride-btn" onclick="this.cancelRide()">Cancel ride</button>
      </div>
    `;
  }

  renderNotifications() {
    return this.notifications.map(notif => `
      <div class="notification-item ${notif.read ? '' : 'unread'}">
        <div class="notification-icon">${notif.icon}</div>
        <div class="notification-content">
          <div class="notification-title">${notif.title}</div>
          <div class="notification-message">${notif.message}</div>
          <div class="notification-time">${notif.time}</div>
        </div>
      </div>
    `).join('');
  }

  attachEventListeners() {
    // Search functionality
    const destinationInput = document.getElementById('destinationInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (destinationInput) {
      destinationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchDestination(destinationInput.value);
        }
      });
      
      destinationInput.addEventListener('input', (e) => {
        this.handleSearchInput(e.target.value);
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.searchDestination(destinationInput.value);
      });
    }

    // Voice search
    const voiceSearchBtn = document.getElementById('voiceSearchBtn');
    if (voiceSearchBtn) {
      voiceSearchBtn.addEventListener('click', () => {
        this.startVoiceSearch();
      });
    }

    // Book ride button
    const bookRideBtn = document.getElementById('bookRideBtn');
    if (bookRideBtn) {
      bookRideBtn.addEventListener('click', () => {
        this.bookRide();
      });
    }

    // Ride options
    document.querySelectorAll('.ride-option').forEach(option => {
      option.addEventListener('click', () => {
        document.querySelectorAll('.ride-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        this.updateSelectedRidePrice();
      });
    });

    // Navigation buttons
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
      notificationBtn.addEventListener('click', () => {
        this.toggleNotifications();
      });
    }

    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        this.toggleProfile();
      });
    }

    // Close buttons
    const closeNotifications = document.getElementById('closeNotifications');
    if (closeNotifications) {
      closeNotifications.addEventListener('click', () => {
        this.hideNotifications();
      });
    }

    const closeProfile = document.getElementById('closeProfile');
    if (closeProfile) {
      closeProfile.addEventListener('click', () => {
        this.hideProfile();
      });
    }

    // Current location button
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    if (currentLocationBtn) {
      currentLocationBtn.addEventListener('click', () => {
        this.centerOnCurrentLocation();
      });
    }

    // Rating stars
    document.querySelectorAll('.star').forEach(star => {
      star.addEventListener('click', (e) => {
        this.rateDriver(parseInt(e.target.dataset.rating));
      });
    });
  }

  initializeMap() {
    const mapOptions = {
      zoom: 15,
      center: { lat: 40.7128, lng: -74.0060 },
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        },
        {
          featureType: 'transit',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ],
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    };

    this.map = new google.maps.Map(document.getElementById('map'), mapOptions);
    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#3b82f6',
        strokeWeight: 6,
        strokeOpacity: 0.8
      }
    });
    this.directionsRenderer.setMap(this.map);

    // Add click listener for map
    this.map.addListener('click', (event) => {
      this.handleMapClick(event.latLng);
    });
  }

  requestLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          this.map.setCenter(this.currentLocation);
          this.addCurrentLocationMarker();
          this.reverseGeocode(this.currentLocation);
          this.updateWeather();
        },
        (error) => {
          console.error('Error getting location:', error);
          this.currentLocation = { lat: 40.7128, lng: -74.0060 };
          this.map.setCenter(this.currentLocation);
          this.addCurrentLocationMarker();
        }
      );
    }
  }

  addCurrentLocationMarker() {
    new google.maps.Marker({
      position: this.currentLocation,
      map: this.map,
      title: 'Your Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      },
      animation: google.maps.Animation.DROP
    });
  }

  startNotificationSystem() {
    this.notifications = [
      {
        id: 1,
        icon: '🎉',
        title: 'Welcome bonus!',
        message: 'Get 20% off your next 3 rides',
        time: '2 min ago',
        read: false
      },
      {
        id: 2,
        icon: '⭐',
        title: 'Rate your last ride',
        message: 'How was your trip with Sarah?',
        time: '1 hour ago',
        read: false
      },
      {
        id: 3,
        icon: '💳',
        title: 'Payment successful',
        message: '$12.50 charged to Visa ****4567',
        time: '2 hours ago',
        read: true
      }
    ];
  }

  loadRideHistory() {
    this.rideHistory = [
      { destination: 'Starbucks Coffee', date: '2 hours ago', price: '$12.50' },
      { destination: 'Downtown Office', date: 'Yesterday', price: '$8.75' },
      { destination: 'Airport Terminal', date: '3 days ago', price: '$45.20' }
    ];
  }

  bookRide() {
    this.showLoading('Finding your ride...');
    
    setTimeout(() => {
      this.currentRide = {
        step: 0,
        progress: 0,
        driverId: 'D123',
        estimatedTime: 12
      };
      
      this.currentStep = 'ride-active';
      this.hideLoading();
      this.showRideStatus();
      this.startRideSimulation();
    }, 3000);
  }

  startRideSimulation() {
    let step = 0;
    const steps = [
      { delay: 2000, step: 1, progress: 25, message: 'Driver found!' },
      { delay: 8000, step: 2, progress: 50, message: 'Driver arrived!' },
      { delay: 3000, step: 3, progress: 75, message: 'On your way!' },
      { delay: 15000, step: 4, progress: 100, message: 'Trip completed!' }
    ];

    const simulateStep = (stepIndex) => {
      if (stepIndex >= steps.length) {
        this.completeRide();
        return;
      }

      setTimeout(() => {
        this.currentRide.step = steps[stepIndex].step;
        this.currentRide.progress = steps[stepIndex].progress;
        this.updateRideStatus();
        this.addNotification('🚗', 'Ride Update', steps[stepIndex].message);
        
        simulateStep(stepIndex + 1);
      }, steps[stepIndex].delay);
    };

    simulateStep(0);
  }

  completeRide() {
    this.currentStep = 'ride-complete';
    this.hideRideStatus();
    this.updateBottomPanel();
    this.addNotification('✅', 'Trip Completed', 'Rate your driver and book another ride!');
  }

  // Enhanced utility methods
  showLoading(text = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('.loading-text');
    loadingText.textContent = text;
    overlay.style.display = 'flex';
  }

  hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
  }

  showRideStatus() {
    document.getElementById('rideStatus').style.display = 'block';
    document.getElementById('bottomPanel').style.display = 'none';
  }

  hideRideStatus() {
    document.getElementById('rideStatus').style.display = 'none';
    document.getElementById('bottomPanel').style.display = 'block';
  }

  updateRideStatus() {
    const rideStatus = document.getElementById('rideStatus');
    if (rideStatus) {
      rideStatus.innerHTML = this.renderRideStatus();
    }
  }

  addNotification(icon, title, message) {
    const notification = {
      id: Date.now(),
      icon,
      title,
      message,
      time: 'now',
      read: false
    };
    
    this.notifications.unshift(notification);
    this.updateNotificationBadge();
  }

  updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = this.notifications.filter(n => !n.read).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'block' : 'none';
  }

  toggleNotifications() {
    const panel = document.getElementById('notificationsPanel');
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      document.getElementById('notificationsList').innerHTML = this.renderNotifications();
      // Mark all as read
      this.notifications.forEach(n => n.read = true);
      this.updateNotificationBadge();
    }
  }

  hideNotifications() {
    document.getElementById('notificationsPanel').style.display = 'none';
  }

  toggleProfile() {
    const panel = document.getElementById('profilePanel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  }

  hideProfile() {
    document.getElementById('profilePanel').style.display = 'none';
  }

  startVoiceSearch() {
    this.addNotification('🎤', 'Voice Search', 'Voice search activated - say your destination');
  }

  updateBottomPanel() {
    const panel = document.getElementById('bottomPanel');
    panel.innerHTML = this.renderBottomContent();
    this.attachEventListeners();
    
    // Add animation
    panel.classList.remove('slide-up');
    setTimeout(() => panel.classList.add('slide-up'), 10);
  }

  // Enhanced search functionality
  handleSearchInput(query) {
    if (query.length > 2) {
      // Simulate autocomplete
      console.log('Autocomplete suggestions for:', query);
    }
  }

  searchDestination(query) {
    if (!query) return;
    
    this.showLoading('Searching destination...');
    
    const service = new google.maps.places.PlacesService(this.map);
    const request = {
      query: query,
      fields: ['name', 'geometry', 'formatted_address']
    };

    service.textSearch(request, (results, status) => {
      this.hideLoading();
      
      if (status === google.maps.places.PlacesServiceStatus.OK && results[0]) {
        const place = results[0];
        const destination = place.geometry.location;

        this.addDestinationMarker(destination, place.name);
        this.calculateRoute(this.currentLocation, destination);
        
        this.currentStep = 'booking';
        this.updateBottomPanel();
      }
    });
  }

  addDestinationMarker(position, title) {
    if (this.destinationMarker) {
      this.destinationMarker.setMap(null);
    }
    
    this.destinationMarker = new google.maps.Marker({
      position: position,
      map: this.map,
      title: title,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#ef4444',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3
      },
      animation: google.maps.Animation.DROP
    });
  }

  calculateRoute(origin, destination) {
    const request = {
      origin: origin,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidTolls: false,
      avoidHighways: false
    };

    this.directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        this.directionsRenderer.setDirections(result);
        
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(destination);
        this.map.fitBounds(bounds, { padding: 100 });
      }
    });
  }

  simulateNearbyDrivers() {
    const drivers = [
      { lat: 40.7138, lng: -74.0050, name: 'John D.', rating: 4.9, eta: 2 },
      { lat: 40.7118, lng: -74.0070, name: 'Sarah M.', rating: 4.8, eta: 3 },
      { lat: 40.7148, lng: -74.0040, name: 'Mike R.', rating: 4.7, eta: 5 }
    ];

    drivers.forEach(driver => {
      const marker = new google.maps.Marker({
        position: { lat: driver.lat, lng: driver.lng },
        map: this.map,
        title: `${driver.name} - ${driver.eta} min away`,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="14" fill="#10b981" stroke="white" stroke-width="2"/>
              <text x="16" y="20" text-anchor="middle" fill="white" font-size="14" font-family="Arial">🚗</text>
            </svg>
          `)}`,
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        },
        animation: google.maps.Animation.DROP
      });
      
      this.driverMarkers.push(marker);
      
      // Animate driver movement
      this.animateDriver(marker);
    });
  }

  animateDriver(marker) {
    setInterval(() => {
      const currentPos = marker.getPosition();
      const newLat = currentPos.lat() + (Math.random() - 0.5) * 0.001;
      const newLng = currentPos.lng() + (Math.random() - 0.5) * 0.001;
      
      marker.setPosition(new google.maps.LatLng(newLat, newLng));
    }, 5000);
  }

  updateWeather() {
    // Simulate weather update
    const weatherWidget = document.getElementById('weatherWidget');
    const weather = {
      temp: Math.floor(Math.random() * 30) + 60,
      condition: ['☀️ Sunny', '⛅ Partly Cloudy', '🌧️ Rainy', '❄️ Snow'][Math.floor(Math.random() * 4)]
    };
    
    if (weatherWidget) {
      weatherWidget.innerHTML = `
        <div class="weather-icon">${weather.condition.split(' ')[0]}</div>
        <div class="weather-info">
          <div class="weather-temp">${weather.temp}°F</div>
          <div class="weather-desc">${weather.condition.split(' ').slice(1).join(' ')}</div>
        </div>
      `;
    }
  }

  centerOnCurrentLocation() {
    if (this.currentLocation) {
      this.map.setCenter(this.currentLocation);
      this.map.setZoom(16);
    }
  }

  rateDriver(rating) {
    document.querySelectorAll('.star').forEach((star, index) => {
      star.style.opacity = index < rating ? '1' : '0.3';
    });
    
    this.addNotification('⭐', 'Rating Submitted', `Thank you for rating ${rating} stars!`);
    
    setTimeout(() => {
      this.startNewRide();
    }, 2000);
  }

  startNewRide() {
    this.currentStep = 'location';
    this.currentRide = null;
    this.updateBottomPanel();
    
    // Clear route
    this.directionsRenderer.setDirections({routes: []});
    if (this.destinationMarker) {
      this.destinationMarker.setMap(null);
    }
  }

  initializeRealTimeTracking() {
    // Simulate real-time updates
    setInterval(() => {
      if (this.currentStep === 'ride-active' && this.currentRide) {
        this.updateRealTimeData();
      }
    }, 2000);
  }

  updateRealTimeData() {
    // Update ETA, speed, etc.
    if (document.getElementById('rideTimer')) {
      const timer = document.getElementById('rideTimer');
      timer.style.display = 'block';
      
      const minutes = Math.floor(Math.random() * 3) + 10;
      const seconds = Math.floor(Math.random() * 60);
      timer.querySelector('.timer-value').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  reverseGeocode(location) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: location }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const address = results[0].formatted_address;
        const locationElement = document.querySelector('.current-location');
        if (locationElement) {
          locationElement.textContent = address;
        }
      }
    });
  }

  handleMapClick(latLng) {
    // Allow users to select destination by tapping map
    if (this.currentStep === 'location') {
      this.addDestinationMarker(latLng, 'Selected Location');
      this.calculateRoute(this.currentLocation, latLng);
      this.currentStep = 'booking';
      this.updateBottomPanel();
    }
  }

  updateSelectedRidePrice() {
    const selected = document.querySelector('.ride-option.selected');
    if (selected) {
      const price = selected.querySelector('.option-price').textContent;
      const bookBtn = document.getElementById('bookRideBtn');
      if (bookBtn) {
        bookBtn.querySelector('.btn-text').textContent = `Request ${selected.dataset.type} - ${price}`;
      }
    }
  }

  cancelRide() {
    if (confirm('Are you sure you want to cancel this ride?')) {
      this.currentStep = 'location';
      this.currentRide = null;
      this.hideRideStatus();
      this.updateBottomPanel();
      this.addNotification('❌', 'Ride Cancelled', 'Your ride has been cancelled');
    }
  }
}

// Enhanced CSS Styles
const styles = `
  * {
    box-sizing: border-box;
  }
  
  .mobile-container {
    position: relative;
    overflow: hidden;
  }

  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px;
    position: relative;
    z-index: 100;
    box-shadow: 0 2px 20px rgba(0,0,0,0.1);
  }

  .location-bar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .location-icon {
    font-size: 20px;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .location-text {
    flex: 1;
  }

  .current-location {
    font-size: 16px;
    font-weight: 600;
    color: white;
  }

  .location-subtext {
    font-size: 12px;
    color: rgba(255,255,255,0.8);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .notification-btn {
    position: relative;
    background: rgba(255,255,255,0.2);
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }

  .notification-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }

  .profile-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;
    backdrop-filter: blur(10px);
  }

  .map-container {
    height: 400px;
    width: 100%;
    position: relative;
  }

  .map-overlay {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 10;
  }

  .current-location-btn {
    background: white;
    border: none;
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    margin-bottom: 12px;
  }

  .weather-widget {
    position: absolute;
    top: 16px;
    left: 16px;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 15px rgba(0,0,0,0.1);
  }

  .weather-icon {
    font-size: 20px;
  }

  .weather-temp {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
  }

  .weather-desc {
    font-size: 12px;
    color: #64748b;
  }

  .ride-timer {
    background: rgba(16, 185, 129, 0.95);
    color: white;
    padding: 8px 12px;
    border-radius: 8px;
    text-align: center;
    backdrop-filter: blur(10px);
  }

  .timer-text {
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .timer-value {
    font-size: 16px;
    font-weight: 700;
  }

  .bottom-panel {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 375px;
    background: white;
    border-radius: 20px 20px 0 0;
    padding: 24px;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.15);
    z-index: 200;
    max-height: 70vh;
    overflow-y: auto;
  }

  .slide-up {
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(100%); }
    to { transform: translateX(-50%) translateY(0); }
  }

  .fade-in {
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .panel-header h2 {
    font-size: 28px;
    font-weight: 800;
    margin-bottom: 16px;
    color: #1e293b;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .search-suggestions {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    overflow-x: auto;
  }

  .suggestion-chip {
    background: #f1f5f9;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    color: #475569;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s;
  }

  .suggestion-chip:hover {
    background: #e2e8f0;
    transform: translateY(-1px);
  }

  .search-container {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .search-input-wrapper {
    flex: 1;
    position: relative;
  }

  .destination-input {
    width: 100%;
    padding: 16px 20px;
    border: 2px solid #e2e8f0;
    border-radius: 16px;
    font-size: 16px;
    background: #f8fafc;
    transition: all 0.3s;
  }

  .destination-input:focus {
    outline: none;
    border-color: #3b82f6;
    background: white;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  .search-btn {
    padding: 16px 20px;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .search-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);
  }

  .voice-search-btn {
    padding: 16px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .voice-search-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
  }

  .recent-destinations h4 {
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 12px;
  }

  .destination-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .destination-item:hover {
    background: #f8fafc;
    transform: translateX(4px);
  }

  .destination-icon {
    font-size: 20px;
  }

  .destination-info {
    flex: 1;
  }

  .destination-name {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
  }

  .destination-address {
    font-size: 12px;
    color: #64748b;
  }

  .destination-distance {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .booking-panel {
    padding: 0;
  }

  .route-summary {
    background: linear-gradient(135deg, #f8fafc, #e2e8f0);
    padding: 20px;
    border-radius: 16px;
    margin-bottom: 24px;
  }

  .route-info-header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 16px;
    align-items: center;
  }

  .route-time {
    text-align: center;
  }

  .time-value {
    font-size: 32px;
    font-weight: 800;
    color: #1e293b;
    display: block;
  }

  .time-unit {
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
  }

  .route-details {
    text-align: center;
  }

  .distance {
    font-size: 16px;
    font-weight: 600;
    color: #374151;
  }

  .traffic-status {
    font-size: 12px;
    color: #10b981;
    font-weight: 500;
  }

  .route-price {
    text-align: center;
  }

  .price-value {
    font-size: 28px;
    font-weight: 800;
    color: #059669;
  }

  .ride-options-container h3 {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 16px;
    color: #1e293b;
  }

  .ride-option {
    border: 2px solid #e5e7eb;
    border-radius: 16px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.3s;
    overflow: hidden;
  }

  .ride-option.selected {
    border-color: #3b82f6;
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
  }

  .premium-option {
    background: linear-gradient(135deg, #ffffff, #f8fafc);
  }

  .option-content {
    display: flex;
    align-items: center;
    padding: 20px;
    gap: 16px;
  }

  .option-icon {
    font-size: 32px;
    min-width: 48px;
  }

  .option-info {
    flex: 1;
  }

  .option-name {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 4px;
  }

  .option-features {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 8px;
  }

  .option-time {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #059669;
  }

  .eta-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
    animation: pulse 2s infinite;
  }

  .option-pricing {
    text-align: right;
  }

  .option-price {
    font-size: 24px;
    font-weight: 800;
    color: #1e293b;
  }

  .price-breakdown {
    font-size: 10px;
    color: #6b7280;
  }

  .booking-footer {
    margin-top: 24px;
  }

  .payment-section {
    margin-bottom: 16px;
  }

  .payment-method {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f8fafc;
    border-radius: 12px;
  }

  .payment-icon {
    font-size: 20px;
  }

  .payment-info {
    flex: 1;
  }

  .payment-name {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
  }

  .payment-default {
    font-size: 12px;
    color: #64748b;
  }

  .change-payment {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .book-ride-btn {
    width: 100%;
    padding: 18px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .premium-btn {
    box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
  }

  .book-ride-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(16, 185, 129, 0.4);
  }

  .btn-loader {
    display: flex;
    align-items: center;
  }

  .spinner-small {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .ride-status {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 375px;
    background: white;
    border-radius: 20px 20px 0 0;
    padding: 24px;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.2);
    z-index: 300;
  }

  .status-progress {
    margin-bottom: 20px;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: #e5e7eb;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    border-radius: 3px;
    transition: width 0.5s ease;
  }

  .driver-card {
    background: linear-gradient(135deg, #f8fafc, #e2e8f0);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .driver-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .driver-avatar-large {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    overflow: hidden;
  }

  .driver-avatar-large img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .driver-details {
    flex: 1;
  }

  .driver-name {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
  }

  .driver-rating {
    font-size: 14px;
    color: #64748b;
    margin: 4px 0;
  }

  .vehicle-info {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .driver-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid #e5e7eb;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  }

  .ride-progress-status {
    margin-bottom: 20px;
  }

  .status-step {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    margin-bottom: 8px;
    border-radius: 12px;
    transition: all 0.3s;
  }

  .status-step.active {
    background: #eff6ff;
    border: 2px solid #3b82f6;
  }

  .status-step.completed {
    background: #ecfdf5;
    border: 2px solid #10b981;
  }

  .step-icon {
    font-size: 24px;
    min-width: 32px;
  }

  .step-content {
    flex: 1;
  }

  .step-title {
    font-size: 16px;
    font-weight: 600;
    color: #1e293b;
  }

  .step-time {
    font-size: 14px;
    color: #64748b;
    margin-top: 2px;
  }

  .live-tracking {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .tracking-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .speed-info, .eta-info {
    text-align: center;
  }

  .speed-value, .eta-value {
    font-size: 24px;
    font-weight: 800;
  }

  .speed-unit, .eta-label {
    font-size: 12px;
    opacity: 0.9;
  }

  .cancel-ride-btn {
    width: 100%;
    padding: 12px;
    background: #fee2e2;
    color: #dc2626;
    border: 2px solid #fecaca;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-ride-btn:hover {
    background: #fecaca;
  }

  .ride-complete-panel {
    text-align: center;
  }

  .complete-header {
    margin-bottom: 24px;
  }

  .complete-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .complete-header h2 {
    font-size: 24px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 8px;
  }

  .complete-header p {
    color: #64748b;
  }

  .trip-summary {
    background: #f8fafc;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .summary-item:last-child {
    margin-bottom: 0;
    padding-top: 12px;
    border-top: 2px solid #e5e7eb;
    font-weight: 700;
  }

  .driver-rating {
    margin-bottom: 24px;
  }

  .driver-rating h3 {
    font-size: 18px;
    margin-bottom: 12px;
  }

  .driver-info-small {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .driver-avatar-small {
    width: 32px;
    height: 32px;
    background: #3b82f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: white;
  }

  .rating-stars {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .star {
    font-size: 32px;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0.3;
  }

  .star:hover {
    transform: scale(1.1);
    opacity: 1;
  }

  .trip-actions {
    display: flex;
    gap: 12px;
  }

  .receipt-btn, .new-ride-btn {
    flex: 1;
    padding: 14px;
    border: 2px solid #e5e7eb;
    background: white;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .new-ride-btn {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    border-color: transparent;
  }

  .notifications-panel, .profile-panel {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 375px;
    height: 100vh;
    background: white;
    z-index: 400;
    overflow-y: auto;
  }

  .notifications-header, .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .profile-header {
    align-items: flex-start;
  }

  .notifications-header h3 {
    font-size: 20px;
    font-weight: 700;
  }

  .close-notifications, .close-profile {
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
  }

  .profile-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    margin-right: 16px;
  }

  .profile-name {
    font-size: 20px;
    font-weight: 700;
  }

  .profile-rating {
    font-size: 14px;
    opacity: 0.9;
  }

  .profile-stats {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    padding: 24px;
    background: #f8fafc;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 800;
    color: #1e293b;
  }

  .stat-label {
    font-size: 12px;
    color: #64748b;
    margin-top: 4px;
  }

  .profile-menu {
    padding: 24px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 8px;
  }

  .menu-item:hover {
    background: #f8fafc;
  }

  .menu-icon {
    font-size: 20px;
    width: 32px;
  }

  .menu-text {
    font-size: 16px;
    font-weight: 500;
    color: #374151;
  }

  .notifications-list {
    padding: 24px;
  }

  .notification-item {
    display: flex;
    gap: 16px;
    padding: 16px;
    border-radius: 12px;
    margin-bottom: 12px;
    transition: all 0.2s;
  }

  .notification-item.unread {
    background: #eff6ff;
    border-left: 4px solid #3b82f6;
  }

  .notification-icon {
    font-size: 24px;
    min-width: 32px;
  }

  .notification-title {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 4px;
  }

  .notification-message {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 4px;
  }

  .notification-time {
    font-size: 11px;
    color: #9ca3af;
  }

  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 500;
    color: white;
  }

  .loading-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(255,255,255,0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  .loading-text {
    font-size: 18px;
    font-weight: 600;
  }

  @media (max-width: 375px) {
    .bottom-panel, .ride-status, .notifications-panel, .profile-panel {
      max-width: 100%;
      left: 0;
      transform: none;
    }
  }
`;

// Add styles to head
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RiderApp();
});
