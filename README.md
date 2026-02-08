# Booking System

A full-stack booking management system for course enrollments with user authentication, payment processing, and administrative features.

## 📋 Project Structure

```
booking-system/
├── booking-system-backend/    # Node.js/Express API server
├── booking-system-frontend/   # React + Vite frontend
└── SETUP_GUIDE.md            # Detailed setup instructions
```

## 🚀 Features

- **User Management**: Registration, authentication, and email verification
- **Course Booking**: Browse courses, manage bookings, and process payments
- **Admin Dashboard**: Manage users, bookings, schedules, and payments
- **Multi-Branch Support**: Handle multiple branch locations
- **Email Notifications**: Automated email service for verification and notifications
- **Responsive Design**: Built with Tailwind CSS for all devices

## 🛠️ Tech Stack

### Backend
- Node.js & Express.js
- MySQL Database
- JWT Authentication
- Nodemailer for emails
- Bcrypt for password hashing

### Frontend
- React 18
- Vite
- Tailwind CSS
- Axios for API calls
- React Router for navigation

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MySQL Server
- npm or yarn

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd booking-system
   ```

2. **Backend Setup**
   ```bash
   cd booking-system-backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd booking-system-frontend
   npm install
   npm run dev
   ```

4. **Database Setup**
   - Create a MySQL database
   - Run the SQL scripts in `booking-system-backend/database.sql`
   - Run migrations in `booking-system-backend/migrations/`

For detailed setup instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)

## 🔐 Environment Variables

### Backend (.env)
```
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=booking_system
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password
```

### Frontend
Update API base URL in `src/services/api.js` if needed.

## 📖 Documentation

- [Setup Guide](SETUP_GUIDE.md) - Complete installation and configuration guide
- [Password Reset Guide](booking-system-backend/PASSWORD_RESET.md) - Password reset functionality
- [Backend README](booking-system-backend/README.md) - Backend API documentation
- [Frontend README](booking-system-frontend/README.md) - Frontend development guide

## 👥 Team Collaboration

This project uses Git for version control and GitHub for collaboration.

### Branching Strategy
- `main` - Production-ready code
- `develop` - Development branch
- `feature/*` - Feature branches
- `bugfix/*` - Bug fix branches

### Workflow
1. Create a feature branch from `develop`
2. Make your changes
3. Commit with clear messages
4. Push and create a Pull Request
5. Request review from team members
6. Merge after approval

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is private and confidential.

## 👨‍💻 Authors

- Marc Jeff - Initial work

## 🐛 Known Issues

- See GitHub Issues for current bugs and feature requests

## 📧 Contact

For questions or support, please contact the development team.
