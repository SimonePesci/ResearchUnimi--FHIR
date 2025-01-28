// app.js
const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Import the initializeWeb3 function
const initializeWeb3 = require("./config/web3");

// Routes
const emrRoutes = require("./routes/emrRoutes");
const userRoutes = require("./routes/userRoutes");
const permissionRoutes = require("./routes/permissionRoutes");

// Function to set up the server after Web3 initialization
const startServer = async () => {
  try {
    // Initialize Web3 and get contract instances
    const { web3, merkleTreeContract, hospitalTokenContract, owner } =
      await initializeWeb3();

    // Make contracts accessible throughout the app via app.locals
    app.locals.web3 = web3;
    app.locals.merkleTreeContract = merkleTreeContract;
    app.locals.hospitalTokenContract = hospitalTokenContract;
    app.locals.owner = owner;

    console.log("Web3 and contracts initialized successfully.");

    // Pass contracts to routes via middleware
    app.use((req, res, next) => {
      req.web3 = app.locals.web3;
      req.merkleTreeContract = app.locals.merkleTreeContract;
      req.hospitalTokenContract = app.locals.hospitalTokenContract;
      req.owner = app.locals.owner;
      next();
    });

    // Initialize routes
    app.use("/emr", emrRoutes);
    app.use("/user", userRoutes);
    app.use("/permission", permissionRoutes);

    // Start the server
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to initialize Web3. Server not started.", error);
    process.exit(1); // Exit the process with failure
  }
};

// Start the server
startServer();

module.exports = app;
