# 💰 Money Agent — Smart Personal Finance Manager

Money Agent is a modern, AI-powered web-based financial management system designed to help you track, analyze, and optimize your finances intelligently. 

Built with a premium, dark-mode-first aesthetic, Money Agent converts your raw financial data into smart financial decisions.

## 🌟 Key Features

* **🗂️ Multi-Wallet System (Sections)**: Organize your money into logical buckets like savings, bills, daily expenses, and custom goals.
* **🤝 Relationship Tracking (Persons)**: Manage financial interactions, track loans, and handle shared expenses with family, friends, and colleagues.
* **💸 Comprehensive Transactions**: Easily log income, expenses, inter-wallet transfers, and loans with a beautifully categorized UI.
* **📈 Smart Analytics**: Visualize your spending patterns with interactive 6-month trend charts, category pie charts, and actionable insights.
* **🤖 AI Financial Advisor**: Get personalized budget suggestions, savings strategies, and expense analysis powered by **Gemini AI**, directly using your live transaction data.
* **🛡️ Secure Vault**: Store sensitive financial data like bank details, credit cards, and secure notes behind a masked, toggleable UI.
* **📥 Export Data**: Instantly download your transaction history as a CSV file for your personal records.

## 🚀 Tech Stack

* **Framework**: Next.js 16 (App Router)
* **Language**: TypeScript
* **Styling**: Tailwind CSS v4
* **Database & Auth**: Firebase (Firestore, Authentication)
* **AI Provider**: Google Gemini 2.0 Flash API
* **Icons & UI**: Lucide React, Framer Motion
* **Charts**: Chart.js & react-chartjs-2

## 🛠️ Getting Started

### Prerequisites

You will need a [Firebase project](https://console.firebase.google.com/) and a [Gemini API Key](https://aistudio.google.com/app/apikey) to run this application.

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd money-agent
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root of the project and add your keys:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"

# Gemini AI Configuration
GEMINI_API_KEY="your-gemini-api-key"
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔒 Database Rules

If using Firebase, ensure you set up your Firestore rules to protect user data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

---
*Built with ❤️ utilizing Next.js & Gemini AI.*
