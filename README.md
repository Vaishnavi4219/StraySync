# StraySync — Stray Animal Management System

StraySync is a web-based stray animal management system designed to help citizens report stray animals and coordinate animal rescue activities through municipal officers and rescue staff.

## Features

* Citizen registration and login
* Mobile number verification workflow
* Report stray animals with descriptions, locations, and photographs
* Track submitted complaints
* Municipal officer complaint management
* Assign rescue cases to field staff
* Staff case management and resolution reporting
* Officer verification of completed rescue reports

## Technology Stack

**Frontend**

* HTML
* CSS
* JavaScript

**Backend**

* Node.js
* Express.js
* REST API

**Database**

* SQLite
* better-sqlite3

## Project Structure

```text
StraySync/
├── backend/
│   ├── config/
│   │   ├── database.js
│   │   └── initDatabase.js
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── auth/
│   ├── citizen/
│   ├── municipal/
│   ├── staff/
│   ├── css/
│   ├── js/
│   └── index.html
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the project:

* Git
* Node.js and npm
* Visual Studio Code (recommended)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Vaishnavi4219/StraySync.git
cd StraySync
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `backend` directory.

Add the environment variables required by the application. Obtain any required secrets or service credentials from the project owner through a secure channel. Never commit real credentials to GitHub.

### 4. Initialize the database

From the `backend` directory, run:

```bash
node config/initDatabase.js
```

This initializes the SQLite database and creates the tables defined in the initialization script.

### 5. Start the server

From the `backend` directory, run:

```bash
npm start
```

The server should run at:

http://localhost:5000

### 6. Check the backend

Open this URL in your browser:

http://localhost:5000/api/health

A successful response should indicate that the StraySync backend is running.

### 7. Open the frontend

Open the homepage:

http://localhost:5000/

The Express server serves the frontend files.

## Database and Uploaded Files

The SQLite database is stored locally at:

`backend/data/straySync.db`

Uploaded animal photographs are stored locally under the backend uploads directory.

These local files are excluded from the Git repository. Each developer should initialize their own database and use their own local uploads.

## Collaboration Guidelines

* Create a separate branch for significant changes.
* Test changes locally before pushing.
* Pull the latest changes before starting new work.
* Never commit `.env` files, credentials, local databases, or private user data.
* Coordinate changes to database schemas and API endpoints with the team.

## Project Status

StraySync is under active development. Some features may require additional configuration or testing before they are ready for deployment.
