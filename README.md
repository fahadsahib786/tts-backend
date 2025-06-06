# TTS Platform Backend

A comprehensive Node.js backend for a Text-to-Speech SaaS platform with subscription management, user authentication, and AWS Polly integration.

## 🚀 Features

### Core Features
- **User Authentication & Authorization**: JWT-based auth with email verification
- **Role-Based Access Control**: Multiple user roles (User, Admin, Super Admin, Finance Admin, Manager)
- **Text-to-Speech**: AWS Polly integration with multiple voices and languages
- **Subscription Management**: Plan-based subscriptions with usage tracking
- **File Management**: AWS S3 storage with automatic cleanup
- **Email Services**: Automated emails for verification, welcome, and notifications
- **Admin Dashboard**: Comprehensive admin panel for user and subscription management

### Security Features
- **Rate Limiting**: Configurable rate limits for API endpoints
- **OTP Verification**: Secure email verification and password reset
- **Input Validation**: Comprehensive request validation
- **Password Security**: Bcrypt hashing with configurable rounds
- **JWT Security**: Secure token generation and validation

### Advanced Features
- **Usage Tracking**: Monthly character and request limits
- **File Retention**: Automatic cleanup of expired files (90 days)
- **Audit Logging**: Track important system events
- **Error Handling**: Comprehensive error handling and logging
- **Scalable Architecture**: Modular design with service layer

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection
│   │   └── polly.js             # AWS Polly configuration
│   ├── controllers/
│   │   ├── auth.controller.js    # Authentication endpoints
│   │   ├── user.controller.js    # User management
│   │   ├── tts.controller.js     # Text-to-speech operations
│   │   ├── plan.controller.js    # Subscription plans
│   │   └── admin.controller.js   # Admin operations
│   ├── middleware/
│   │   ├── auth.js              # Authentication middleware
│   │   ├── limiter.js           # Rate limiting
│   │   └── roleMiddleware.js    # Role-based access control
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Plan.js              # Subscription plan schema
│   │   ├── Subscription.js      # User subscription schema
│   │   ├── Usage.js             # Usage tracking schema
│   │   ├── VoiceFile.js         # Generated audio files schema
│   │   └── OTP.js               # OTP verification schema
│   ├── routes/
│   │   ├── auth.routes.js       # Authentication routes
│   │   ├── user.routes.js       # User routes
│   │   ├── tts.routes.js        # TTS routes
│   │   ├── plan.routes.js       # Plan routes
│   │   └── admin.routes.js      # Admin routes
│   ├── services/
│   │   ├── emailService.js      # Email operations
│   │   ├── ttsService.js        # TTS operations
│   │   ├── storageService.js    # S3 storage operations
│   │   └── otpService.js        # OTP management
│   ├── utils/
│   │   ├── email.js             # Email utilities
│   │   ├── otp.js               # OTP utilities
│   │   └── cleanup.js           # Cleanup utilities
│   └── app.js                   # Express app configuration
├── .env.example                 # Environment variables template
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- AWS Account (for Polly and S3)
- Gmail account (for SMTP)

### 1. Clone and Install
```bash
git clone <repository-url>
cd backend
npm install
```

### 2. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/tts-platform

# JWT
JWT_SECRET=your-super-secret-jwt-key

# AWS
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket

# Email (Gmail)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
```

### 3. AWS Setup

#### S3 Bucket
1. Create an S3 bucket for audio files
2. Configure bucket permissions (private by default)
3. Set up lifecycle rules for automatic cleanup

#### Polly Access
1. Ensure your AWS credentials have Polly access
2. Test with `aws polly describe-voices` command

#### IAM Permissions
Required AWS permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "polly:DescribeVoices",
                "polly:SynthesizeSpeech"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

### 4. Database Setup
```bash
# Start MongoDB (if running locally)
mongod

# The application will create collections automatically
```

### 5. Start the Server
```bash
# Development
npm run dev

# Production
npm start
```

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

#### Verify Email
```http
POST /api/auth/verify-email
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

### TTS Endpoints

#### Get Available Voices
```http
GET /api/tts/voices?language=en-US&engine=standard
Authorization: Bearer <jwt-token>
```

#### Convert Text to Speech
```http
POST /api/tts/convert
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "text": "Hello, this is a test message.",
  "voiceId": "Joanna",
  "outputFormat": "mp3",
  "engine": "standard"
}
```

#### Preview Voice
```http
POST /api/tts/preview
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "voiceId": "Joanna",
  "sampleText": "This is a voice preview."
}
```

### User Management

#### Get Profile
```http
GET /api/user/profile
Authorization: Bearer <jwt-token>
```

#### Get Usage Statistics
```http
GET /api/user/usage
Authorization: Bearer <jwt-token>
```

#### Get User Files
```http
GET /api/user/files?page=1&limit=10
Authorization: Bearer <jwt-token>
```

### Subscription Management

#### Get Available Plans
```http
GET /api/plans
```

#### Subscribe to Plan
```http
POST /api/plans/subscribe
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "planId": "plan-id-here"
}
```

#### Upload Payment Proof
```http
POST /api/plans/payment-proof/:subscriptionId
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data

file: <payment-proof-file>
```

### Admin Endpoints

#### Get All Users
```http
GET /api/admin/users?page=1&limit=20&status=active
Authorization: Bearer <admin-jwt-token>
```

#### Get Pending Subscriptions
```http
GET /api/admin/subscriptions/pending
Authorization: Bearer <finance-admin-jwt-token>
```

#### Approve Subscription
```http
PUT /api/admin/subscriptions/:id/approve
Authorization: Bearer <finance-admin-jwt-token>
Content-Type: application/json

{
  "approved": true,
  "notes": "Payment verified"
}
```

## 🔐 User Roles & Permissions

### User Roles
- **User**: Basic user with TTS access
- **Manager**: Can view users and statistics
- **Finance Admin**: Can approve payments and manage subscriptions
- **Admin**: Full user and system management
- **Super Admin**: Complete system access including role management

### Permission Matrix
| Permission | User | Manager | Finance Admin | Admin | Super Admin |
|------------|------|---------|---------------|-------|-------------|
| Use TTS | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Own Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| View All Users | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit Users | ❌ | ❌ | ❌ | ✅ | ✅ |
| Approve Payments | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage Roles | ❌ | ❌ | ❌ | ❌ | ✅ |

## 🔧 Configuration

### Rate Limiting
Configure rate limits in `.env`:
```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # 100 requests per window
```

### OTP Settings
```env
OTP_EXPIRY_MINUTES=10        # OTP expires in 10 minutes
OTP_MAX_ATTEMPTS=5           # Max verification attempts
OTP_RATE_LIMIT_WINDOW=5      # Rate limit window in minutes
```

### File Cleanup
```env
CLEANUP_INTERVAL_HOURS=24    # Run cleanup every 24 hours
FILE_RETENTION_DAYS=90       # Keep files for 90 days
```

## 🧹 Maintenance

### Automatic Cleanup
The system automatically cleans up:
- Expired voice files (90+ days old)
- Failed file records (7+ days old)
- Expired OTP records
- Orphaned S3 files

### Manual Cleanup
```bash
# Run cleanup manually (if needed)
node -e "require('./src/utils/cleanup').manualCleanup('all')"
```

### Database Indexes
Ensure these indexes exist for optimal performance:
```javascript
// Users collection
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ role: 1 })

// Voice files collection
db.voicefiles.createIndex({ user: 1, createdAt: -1 })
db.voicefiles.createIndex({ createdAt: 1 })

// OTPs collection
db.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
db.otps.createIndex({ email: 1, type: 1 })

// Usage collection
db.usages.createIndex({ user: 1, month: 1, year: 1 }, { unique: true })
```

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
DEBUG=false
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/tts-platform
FRONTEND_URL=https://yourdomain.com
```

### PM2 Configuration
```json
{
  "name": "tts-backend",
  "script": "src/app.js",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production",
    "PORT": 5000
  }
}
```

### Docker Support
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🔍 Monitoring & Logging

### Health Check Endpoint
```http
GET /health
```

### Error Logging
Errors are logged with context:
```javascript
console.error('Operation failed:', {
  error: error.message,
  userId: req.user?.id,
  endpoint: req.path,
  timestamp: new Date().toISOString()
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Complete TTS functionality
- User authentication and authorization
- Subscription management
- Admin dashboard
- AWS Polly and S3 integration
- Email services
- Automatic cleanup
- Comprehensive API documentation
