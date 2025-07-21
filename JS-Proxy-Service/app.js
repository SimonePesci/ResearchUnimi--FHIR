const express = require("express");
const app = express();
// require("dotenv").config();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Import the initializeWeb3 function
const { init } = require("./config/web3");

// Routes
const emrRoutes = require("./routes/emrRoutes");
const userRoutes = require("./routes/userRoutes");
const permissionRoutes = require("./routes/permissionRoutes");

// Function to set up the server after Web3 initialization
const startServer = async () => {
  try {
    // Initialize Web3 and get contract instances
    // await init();

    // Initialize routes
    app.use("/emr", emrRoutes);
    app.use("/user", userRoutes);
    app.use("/permission", permissionRoutes);

    // Test route
    app.get("/", (req, res) => {
      res.json({ message: "Server is running!" });
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).json({
        success: false,
        message: err.message || "Something went wrong!",
      });
    });

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
