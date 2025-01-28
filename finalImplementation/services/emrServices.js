// services/emrService.js
// check the updateEMR, first get the merkle root, then update but with the encrypted data (put the prev data back on cassandra)
const cassandraClient = require("../config/cassandra");
const { web3, merkleTreeContract, owner } = require("../config/web3");
const axios = require("axios");
const permissionService = require("./permissionService");
const blockchainService = require("./blockchainService");
const { PERMISSIONS } = require("../config/constants");
const keccak256 = require("keccak256"); // <-- Imported keccak256
const { MerkleTree } = require("merkletreejs"); // If not already imported
const { checkIntegrity } = require("../config/web3");

// Define constants for patientId and doctorId
const PATIENT_ID_CONSTANT = "patient_constant_id";
const DOCTOR_ID_CONSTANT = "doctor_constant_id";

// Updated updateEMR function
// Updated updateEMR function
exports.updateEMR = async (contracts, data) => {
  const {
    userType,
    tokenID,
    hospitalID,
    resource_type,
    EMR_To_Update, // Assuming this is the resource_id
    new_EMR_Value,
  } = data;

  // -----------------------------
  // 1. Input Validation
  // -----------------------------
  if (
    !userType ||
    !tokenID ||
    !hospitalID ||
    !resource_type ||
    !EMR_To_Update ||
    !new_EMR_Value
  ) {
    throw new Error(
      "Missing required fields: userType, tokenID, hospitalID, resource_type, EMR_To_Update, new_EMR_Value"
    );
  }

  // -----------------------------
  // 2. Permission Verification
  // -----------------------------
  const permissionGranted = await permissionService.verifyPermissions(
    contracts,
    {
      userType,
      tokenID,
      hospitalID,
      permission: PERMISSIONS.WRITE_EMR,
    }
  );

  if (!permissionGranted) {
    throw new Error("Permissions not granted for updating EMR.");
  }

  // -----------------------------
  // 3. Fetch Current Merkle Root
  // -----------------------------
  // const previousMerkleRoot = await getCurrentMerkleRoot(contracts);

  try {
    // Step 1: Retrieve all EMR data from Cassandra
    const query = "SELECT data FROM fhir_resources";
    const result = await cassandraClient.execute(query);
    const EMRValuesArray = result.rows.map((row) => row.data);

    if (EMRValuesArray.length === 0) {
      throw new Error("No EMR records found in the database.");
    }

    console.log(`Total EMRs retrieved: ${EMRValuesArray.length}`);

    // Step 2: Create leaf nodes by hashing the EMR data
    const leafNodes = EMRValuesArray.map((EMR) => keccak256(EMR));

    // Step 3: Build the Merkle Tree
    const EMR_Tree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

    // Step 4: Get the new Merkle root
    const newMerkleRoot = EMR_Tree.getHexRoot();
    console.log("Current Merkle Root:", newMerkleRoot);
  } catch {
    throw new Error("Unable to calculate root");
  }

  // -----------------------------
  // 4. Determine New Version ID
  // -----------------------------
  // let new_version_id;
  // try {
  //   new_version_id = await getLatestVersionId(resource_type, EMR_To_Update);
  // } catch (error) {
  //   throw new Error(error.message);
  // }
  let new_version_id = 1;

  // -----------------------------
  // 5. Encrypt EMR Data via Flask App
  // -----------------------------
  let encryptResponse;
  try {
    encryptResponse = await axios.post("http://127.0.0.1:5000/encrypt_emr", {
      patient_id: PATIENT_ID_CONSTANT,
      plaintext: new_EMR_Value,
    });
  } catch (error) {
    throw new Error(`Failed to encrypt EMR data: ${error.message}`);
  }
  console.log("Encrypted data:", encryptResponse.data);

  const { capsule, ciphertext } = encryptResponse.data.EMR;

  if (!capsule || !ciphertext) {
    throw new Error(
      "Encryption failed: Missing capsule or ciphertext in response."
    );
  }

  // -----------------------------
  // 6. Generate KFrags for Authorized Doctors
  // -----------------------------
  const authorizedDoctors = [DOCTOR_ID_CONSTANT];
  try {
    await axios.post("http://127.0.0.1:5000/generate_kfrags", {
      patient_id: PATIENT_ID_CONSTANT,
      doctor_ids: authorizedDoctors,
    });
  } catch (error) {
    throw new Error(`Failed to generate KFrags: ${error.message}`);
  }

  // -----------------------------
  // 7. Prepare Data for Cassandra
  // -----------------------------
  const encryptedEMRData = JSON.stringify({
    capsule: capsule, // Base64-encoded capsule string
    ciphertext: ciphertext, // Base64-encoded ciphertext string
  });

  console.log("Encypted data stringify:", encryptedEMRData);

  // const resource_uuid = uuidv4(); // Generate a new UUID for each EMR version

  // -----------------------------
  // 8. Update EMR in Cassandra
  // -----------------------------

  const updateQuery = `
    UPDATE fhir_resources
    SET data = ?
    WHERE resource_type = ? AND resource_id = ? AND version_id = ?
  `;

  try {
    await cassandraClient.execute(
      updateQuery,
      [encryptedEMRData, "Patient", "example-patient-1", "1"],
      { prepare: true }
    );
  } catch (error) {
    throw new Error(`Cassandra INSERT failed: ${error.message}`);
  }

  // -----------------------------
  // 9. Recompute Merkle Root After Update
  // -----------------------------
  const newRoot = await blockchainService.updateMerkleRoot(
    contracts,
    cassandraClient
  );

  return {
    success: true,
    message: "EMR updated and encrypted successfully",
    newRoot,
  };
};
// exports.updateEMR = async (contracts, data) => {
//   const {
//     userType,
//     tokenID,
//     hospitalID,
//     resource_type,
//     EMR_To_Update,
//     new_EMR_Value,
//   } = data;

//   // Validate input
//   if (
//     !userType ||
//     !tokenID ||
//     !hospitalID ||
//     !resource_type ||
//     !EMR_To_Update ||
//     !new_EMR_Value
//   ) {
//     throw new Error(
//       "Missing required fields: userType, tokenID, hospitalID, resource_type, EMR_To_Update, new_EMR_Value"
//     );
//   }

//   // Check permissions
//   const permissionGranted = await permissionService.verifyPermissions(
//     contracts,
//     {
//       userType,
//       tokenID,
//       hospitalID,
//       permissions: PERMISSIONS.WRITE_EMR,
//     }
//   );

//   if (!permissionGranted) {
//     throw new Error("Permissions not granted for updating EMR.");
//   }

//   // Check integrity
//   const integrityResult = await exports.checkIntegrity(
//     contracts,
//     EMR_To_Update
//   );
//   if (!integrityResult.isValid) {
//     throw new Error("Integrity check failed. EMR data may be compromised.");
//   }

//   // Use constant patientID
//   const patientID = PATIENT_ID_CONSTANT;

//   // Encrypt the new EMR value
//   const encryptResponse = await axios.post(
//     "http://localhost:5000/encrypt_emr",
//     {
//       patient_id: patientID,
//       plaintext: new_EMR_Value,
//     }
//   );

//   const { capsule, ciphertext } = encryptResponse.data;

//   // Generate kfrags for authorized doctors
//   // For testing, we can use the constant doctorId
//   const authorizedDoctors = [DOCTOR_ID_CONSTANT];
//   const kfragsResponse = await axios.post(
//     "http://localhost:5000/generate_kfrags",
//     {
//       patient_id: patientID,
//       doctor_ids: authorizedDoctors,
//     }
//   );

//   const kfrags = kfragsResponse.data;

//   // Update EMR in Cassandra
//   const updateQuery = `
//     UPDATE fhir_resources
//     SET data = ?
//     WHERE id = ? ALLOW FILTERING
//   `;
//   const encryptedEMRData = JSON.stringify({
//     ciphertext,
//     capsule,
//     kfrags,
//     patient_id: patientID,
//   });

//   await cassandraClient.execute(
//     updateQuery,
//     [encryptedEMRData, EMR_To_Update],
//     { prepare: true }
//   );

//   // Recompute Merkle Root and update in smart contract
//   const newRoot = await blockchainService.updateMerkleRoot(
//     contracts,
//     cassandraClient
//   );

//   return {
//     success: true,
//     message: "EMR updated and encrypted successfully",
//     newRoot,
//   };
// };

// Implement accessEMR
// Updated accessEMR function
exports.accessEMR = async (contracts, data) => {
  const {
    userType,
    tokenID,
    hospitalID,
    resource_type,
    EMR_To_Access, // Assuming this is the resource_id
    version_id,
  } = data;

  // -----------------------------
  // 1. Input Validation
  // -----------------------------
  if (
    !userType ||
    !tokenID ||
    !hospitalID ||
    !resource_type ||
    !EMR_To_Access ||
    !version_id
  ) {
    throw new Error(
      "Missing required fields: userType, tokenID, hospitalID, resource_type, EMR_To_Access, version_id"
    );
  }

  // -----------------------------
  // 2. Permission Verification
  // -----------------------------

  const permissionGranted = await permissionService.verifyPermissions(
    contracts,
    {
      userType,
      tokenID,
      hospitalID,
      permission: PERMISSIONS.READ_EMR,
    }
  );

  if (!permissionGranted) {
    throw new Error("Permissions not granted for reading EMR.");
  }

  // -----------------------------
  // 3. Retrieve Encrypted EMR from Cassandra
  // -----------------------------
  const query = `
    SELECT data FROM fhir_resources
    WHERE resource_type = ? AND resource_id = ? AND version_id = ?
  `;
  try {
    const result = await cassandraClient.execute(
      query,
      ["Patient", "example-patient-1", "1"],
      { prepare: true }
    );

    if (result.rows.length === 0) {
      throw new Error("EMR not found.");
    }

    const encryptedEMRData = JSON.parse(result.rows[0].data);
    const { capsule, ciphertext } = encryptedEMRData;

    if (!capsule || !ciphertext) {
      throw new Error("Encrypted EMR data is incomplete.");
    }

    // -----------------------------
    // 4. Call Flask Decryption API
    // -----------------------------
    let decryptResponse;
    try {
      decryptResponse = await axios.post("http://127.0.0.1:5000/decrypt_emr", {
        doctor_id: DOCTOR_ID_CONSTANT,
        patient_id: "patient_constant_id", // Replace with actual patient_id if dynamic
        capsule: capsule,
        ciphertext: ciphertext,
      });
    } catch (error) {
      throw new Error(
        `Failed to decrypt EMR data: ${
          error.response ? error.response.data.error : error.message
        }`
      );
    }

    const { plaintext } = decryptResponse.data;

    if (!plaintext) {
      throw new Error("Decryption failed: No plaintext returned.");
    }

    // -----------------------------
    // 5. Return Decrypted EMR
    // -----------------------------
    return {
      success: true,
      message: "EMR accessed and decrypted successfully",
      EMR: plaintext,
    };
  } catch (error) {
    throw new Error(`Failed to access EMR: ${error.message}`);
  }
};

// Implement addNewEMR
exports.addNewEMR = async (contracts, data) => {
  const { userType, tokenID, hospitalID, resource_type, EMR_Value } = data;

  // Validate input
  if (!userType || !tokenID || !hospitalID || !resource_type || !EMR_Value) {
    throw new Error(
      "Missing required fields: userType, tokenID, hospitalID, resource_type, EMR_Value"
    );
  }

  // Check permissions
  const permissionGranted = await permissionService.verifyPermissions(
    contracts,
    {
      userType,
      tokenID,
      hospitalID,
      permissions: PERMISSIONS.WRITE_EMR,
    }
  );

  if (!permissionGranted) {
    throw new Error("Permissions not granted for adding new EMR.");
  }

  // Use constant patientID
  const patientID = PATIENT_ID_CONSTANT;

  // Encrypt the EMR value
  const encryptResponse = await axios.post(
    "http://localhost:5000/encrypt_emr",
    {
      patient_id: patientID,
      plaintext: EMR_Value,
    }
  );

  const { capsule, ciphertext } = encryptResponse.data;

  // Generate kfrags for authorized doctors
  const authorizedDoctors = [DOCTOR_ID_CONSTANT];
  const kfragsResponse = await axios.post(
    "http://localhost:5000/generate_kfrags",
    {
      patient_id: patientID,
      doctor_ids: authorizedDoctors,
    }
  );

  const kfrags = kfragsResponse.data;

  // Generate a new resource_id (EMR ID)
  const resource_id = uuidv4();

  // Insert new EMR into Cassandra
  const insertQuery = `
    INSERT INTO fhir_resources (resource_id, resource_type, version_id, data)
    VALUES (?, ?, ?, ?)
  `;

  const encryptedEMRData = JSON.stringify({
    ciphertext,
    capsule,
    kfrags,
    patient_id: patientID,
  });

  await cassandraClient.execute(
    insertQuery,
    [resource_id, resource_type, "1", encryptedEMRData],
    { prepare: true }
  );

  // Recompute Merkle Root and update in smart contract
  const newRoot = await blockchainService.updateMerkleRoot(
    contracts,
    cassandraClient
  );

  return {
    success: true,
    message: "New EMR added and encrypted successfully",
    resource_id,
    newRoot,
  };
};

// Implement checkIntegrity
exports.checkIntegrity = async (contracts, EMR_id) => {
  try {
    if (!EMR_id) {
      throw new Error("EMR_id is required for integrity check.");
    }

    // Fetch the EMR data for the given EMR_id
    const query =
      "SELECT data FROM fhir_resources WHERE id = ? ALLOW FILTERING";
    const result = await cassandraClient.execute(query, [EMR_id], {
      prepare: true,
    });

    if (result.rows.length === 0) {
      throw new Error("EMR not found.");
    }

    const EMRData = result.rows[0].data;

    // Compute the hash of the EMR data (leaf node)
    const leafNode = keccak256(EMRData);

    // Build the Merkle tree and generate the proof for this leaf node
    // Retrieve all EMR data to build the tree
    const allEMRQuery = "SELECT data FROM fhir_resources";
    const allEMRResult = await cassandraClient.execute(allEMRQuery);
    const EMRValuesArray = allEMRResult.rows.map((row) => row.data);

    // Build leaf nodes
    const leafNodes = EMRValuesArray.map((EMR) => keccak256(EMR));

    // Build the Merkle Tree
    const merkleTree = new MerkleTree(leafNodes, keccak256, {
      sortPairs: true,
    });

    // Find the index of the leaf node we are interested in
    const leafIndex = EMRValuesArray.findIndex((data) => data === EMRData);

    if (leafIndex === -1) {
      throw new Error("Leaf node not found in tree.");
    }

    // Get the proof for the leaf node
    const proofBuffer = merkleTree.getProof(leafNodes[leafIndex]);

    // Convert the proof to an array of hex strings
    const proof = proofBuffer.map((item) => "0x" + item.data.toString("hex"));

    // Now get the leaf as hex string
    const leafHex = "0x" + leafNode.toString("hex");

    // Call the contract's verify function
    const isValid = await contracts.merkleTreeContract.methods
      .verify(leafHex, proof)
      .call();

    return {
      success: true,
      isValid,
    };
  } catch (error) {
    console.error("Error in checkIntegrity:", error);
    throw error;
  }
};
