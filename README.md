# SafeMed: Decentralized EMR Management System

This project is a secure, decentralized Electronic Medical Record (EMR) management system that leverages blockchain technology, proxy re-encryption, and a microservices architecture to ensure data integrity, security, and controlled access.

## System Architecture

The system is composed of two main backend services, a blockchain for trust and an off-chain database for encrypted data storage.

![System Architecture Diagram](https://i.imgur.com/your-diagram-image-link.png)
_You can upload the diagram generated earlier and replace this link._

- **JS Proxy Service (Node.js/Express)**: The main entry point for the client application. It handles business logic, user authentication, permission management, and orchestrates communication with other services.
- **Proxy Re-Encryption Service (Python/Flask)**: Manages all cryptographic operations. It handles EMR encryption, key generation, and re-encryption for secure data sharing between patients and doctors.
- **Ganache Blockchain**: A private Ethereum blockchain used to manage user identity (as NFTs via ERC1155), and to store permission hashes and the Merkle Root of all EMRs, ensuring data integrity.
- **Cassandra DB**: A NoSQL database used to store large, encrypted EMR data and user permissions off-chain.

---

## Features

- **Decentralized Identity**: User roles (Doctor, Patient, Assistant) are minted as ERC1155 tokens on the blockchain.
- **Granular Access Control**: A sophisticated permission system allows for fine-grained access rights to medical records, with permissions stored both on-chain (as a hash) and off-chain.
- **End-to-End Encryption**: EMRs are encrypted using Proxy Re-Encryption (PRE), ensuring that only authorized users can access the data. The patient holds the ultimate power to grant or revoke access.
- **Data Integrity**: The integrity of all EMRs is verifiable at any time by checking a Merkle Root stored on the blockchain.

---

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/en/) (v14 or later)
- [Python](https://www.python.org/downloads/) (v3.8 or later)
- [Ganache](https://trufflesuite.com/ganache/): A personal blockchain for Ethereum development.
- [Truffle](https://trufflesuite.com/truffle/): A development environment for Ethereum.
- [Docker](https://www.docker.com/products/docker-desktop/): For running the Cassandra database.

---

## Setup and Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd <your-project-folder>
```

### 2. Set up Cassandra

Run a Cassandra instance using Docker. This command will start a Cassandra container and expose it on port 9042.

```bash
docker run --name cassandra -p 9042:9042 -d cassandra:latest
```

Wait a few moments for the database to initialize, then create the keyspace and tables.

```bash
docker exec -it cassandra cqlsh
```

Inside the `cqlsh` shell, run the following commands:

```cql
CREATE KEYSPACE fhir_data WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };

USE fhir_data;

CREATE TABLE fhir_resources (
  resource_id text PRIMARY KEY,
  resource_type text,
  version_id text,
  data text
);

CREATE TABLE user_permissions (
  user_type text,
  token_id text,
  hospital_id int,
  permissions text,
  PRIMARY KEY ((user_type, token_id), hospital_id)
);

CREATE TABLE patient_keys (
  patient_id text PRIMARY KEY,
  public_key text
);

CREATE TABLE doctor_keys (
  doctor_id text PRIMARY KEY,
  public_key text
);

exit;
```

### 3. Set up Ganache

Launch Ganache and create a new workspace. Make sure it's running on `HTTP://127.0.0.1:7545`.

### 4. Deploy Smart Contracts

The project uses Truffle to manage and deploy smart contracts.

```bash
# Navigate to the root of the project if you are not already there
npm install -g truffle # If you don't have it installed globally
truffle migrate --network development
```

After deployment, note the contract addresses for `HospitalToken` and `MerkleTree`. You might need them for the `.env` configuration. Also, copy the address of the account that deployed the contracts (usually the first one in Ganache).

### 5. Configure Environment Variables

The `JS-Proxy-Service` requires a `.env` file for configuration. Create a file named `.env` in the `JS-Proxy-Service` directory.

**/JS-Proxy-Service/.env**

```env
# The URL of your Ganache instance
WEB3_PROVIDER_URL=HTTP://127.0.0.1:7545

# The public key of the account that deployed the smart contracts
OWNER_ADDRESS=<your-ganache-account-address>
```

### 6. Install Dependencies and Run Services

#### a) JS Proxy Service

```bash
cd JS-Proxy-Service
npm install

# Start the service
npm start
```

The service will run on `http://localhost:3000`.

#### b) Proxy Re-Encryption Service

First, create a `requirements.txt` file in the `proxy-reEncryption` directory.

**/proxy-reEncryption/requirements.txt**

```
Flask
umbral
```

Now, install the dependencies and run the service. It is recommended to use a virtual environment.

```bash
cd proxy-reEncryption

# Create and activate a virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`

pip install -r requirements.txt

# Start the service
python app.py
```

The service will run on `http://localhost:5001`.

---

## API Documentation

The following are the main API endpoints exposed by the `JS-Proxy-Service`.

### User Management

#### `POST /user/create-user`

Creates a new user (Doctor, Patient, or Assistant) on the blockchain and generates cryptographic keys.

- **Request Body**:
  ```json
  {
    "userType": "doctor",
    "address": "<ethereum-address-of-user>",
    "name": "John",
    "surname": "Doe",
    "taxCode": "TAXCODE123"
  }
  ```

### Permission Management

#### `POST /permission/assign-permission`

Assigns permissions to a user for a specific hospital.

- **Request Body**:
  ```json
  {
    "userType": "doctor",
    "tokenID": "1",
    "hospitalID": 1,
    "permission": ["READ_EMR", "WRITE_EMR"]
  }
  ```

### EMR Management

#### `POST /emr/add-new-emr`

Adds a new, encrypted EMR to the system.

- **Request Body**:
  ```json
  {
    "userType": "doctor",
    "tokenID": "1",
    "hospitalID": 1,
    "resource_type": "Observation",
    "EMR_Value": "Blood Pressure: 120/80 mmHg"
  }
  ```

#### `POST /emr/access-emr`

Accesses and decrypts an EMR for an authorized user.

- **Request Body**:
  ```json
  {
    "userType": "doctor",
    "tokenID": "1",
    "hospitalID": 1,
    "resource_type": "Patient",
    "version_id": "1",
    "EMR_To_Access": "<resource-id-of-emr>"
  }
  ```

#### `POST /emr/check-integrity`

Verifies if an EMR has been tampered with by checking it against the Merkle Root on the blockchain.

- **Request Body**:
  ```json
  {
    "EMR_id": "<resource-id-of-emr>"
  }
  ```

---

## `.gitignore`

It is recommended to add the following to your `.gitignore` file to avoid committing unnecessary files:

```
# Dependencies
/node_modules
/JS-Proxy-Service/node_modules

# Python virtual environment
/proxy-reEncryption/venv
/finalImplementation/venv

# Environment files
.env
*/.env

# Build artifacts
/build

# IDE and OS files
.DS_Store
.vscode/
```
