const cassandraClient = require("../config/cassandra");
const { web3Config } = require("../config/web3");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const permissionService = require("./permissionService");
const blockchainService = require("./blockchainService");
const { PERMISSIONS, PROXY_RE_ENCRYPTION_URL } = require("../config/constants");
const keccak256 = require("keccak256");
const { MerkleTree } = require("merkletreejs");

const PATIENT_ID_CONSTANT = "patient_constant_id";
const DOCTOR_ID_CONSTANT = "doctor_constant_id";

const _encryptEMR = async (patientId, plaintext) => {
  try {
    const response = await axios.post(
      `${PROXY_RE_ENCRYPTION_URL}/encrypt_emr`,
      {
        patient_id: patientId,
        plaintext: plaintext,
      }
    );
    const { capsule, ciphertext } = response.data.EMR;
    if (!capsule || !ciphertext) {
      throw new Error(
        "Encryption failed: Missing capsule or ciphertext in response."
      );
    }
    return { capsule, ciphertext };
  } catch (error) {
    throw new Error(`Failed to encrypt EMR data: ${error.message}`);
  }
};

const _generateKFrags = async (patientId, doctorIds) => {
  try {
    await axios.post(`${PROXY_RE_ENCRYPTION_URL}/generate_kfrags`, {
      patient_id: patientId,
      doctor_ids: doctorIds,
    });
  } catch (error) {
    throw new Error(`Failed to generate KFrags: ${error.message}`);
  }
};

exports.updateEMR = async (data) => {
  const {
    userType,
    tokenID,
    hospitalID,
    new_EMR_Value,
    resource_type,
    resource_id,
    version_id,
  } = data;

  if (
    !userType ||
    !tokenID ||
    !hospitalID ||
    !new_EMR_Value ||
    !resource_type ||
    !resource_id ||
    !version_id
  ) {
    throw new Error(
      "Missing required fields: userType, tokenID, hospitalID, new_EMR_Value, resource_type, resource_id, version_id"
    );
  }

  const permissionGranted = await permissionService.verifyPermissions({
    userType,
    tokenID,
    hospitalID,
    permission: PERMISSIONS.WRITE_EMR,
  });

  if (!permissionGranted) {
    throw new Error("Permissions not granted for updating EMR.");
  }

  const checkIntegrity = await this.checkIntegrity(resource_id);
  if (!checkIntegrity.isValid) {
    throw new Error("EMRs integrity check failed.");
  }

  const { capsule, ciphertext } = await _encryptEMR(
    PATIENT_ID_CONSTANT,
    new_EMR_Value
  );

  await _generateKFrags(PATIENT_ID_CONSTANT, [DOCTOR_ID_CONSTANT]);

  const encryptedEMRData = JSON.stringify({ capsule, ciphertext });

  const updateQuery = `
    UPDATE fhir_resources
    SET data = ?
    WHERE resource_id = ?
  `;

  try {
    await cassandraClient.execute(
      updateQuery,
      [encryptedEMRData, resource_id],
      { prepare: true }
    );
  } catch (error) {
    throw new Error(`Cassandra UPDATE failed: ${error.message}`);
  }

  const newRoot = await blockchainService.updateMerkleRoot(cassandraClient);

  return {
    success: true,
    message: "EMR updated and encrypted successfully",
    newRoot,
  };
};

exports.accessEMR = async (data) => {
  const {
    userType,
    tokenID,
    hospitalID,
    resource_type,
    EMR_To_Access,
    version_id,
  } = data;

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

  const permissionGranted = await permissionService.verifyPermissions({
    userType,
    tokenID,
    hospitalID,
    permission: PERMISSIONS.READ_EMR,
  });

  if (!permissionGranted) {
    throw new Error("Permissions not granted to access EMR.");
  }

  const checkIntegrity = await this.checkIntegrity(resource_id);
  if (!checkIntegrity.isValid) {
    throw new Error("EMRs integrity check failed.");
  }

  let emrData;
  try {
    const query = `
      SELECT data
      FROM fhir_resources
      WHERE resource_type = ? AND resource_id = ? AND version_id = ? ALLOW FILTERING
    `;
    const result = await cassandraClient.execute(
      query,
      [resource_type, EMR_To_Access, version_id],
      { prepare: true }
    );
    if (result.rows.length === 0) {
      throw new Error("EMR not found.");
    }
    emrData = result.rows[0].data;
  } catch (error) {
    throw new Error(`Cassandra SELECT failed: ${error.message}`);
  }

  const { capsule, ciphertext } = JSON.parse(emrData);
  const decryptResponse = await axios.post(
    `${PROXY_RE_ENCRYPTION_URL}/decrypt_emr`,
    {
      patient_id: PATIENT_ID_CONSTANT,
      doctor_id: DOCTOR_ID_CONSTANT,
      capsule: capsule,
      ciphertext: ciphertext,
    }
  );

  return {
    success: true,
    message: "EMR accessed successfully",
    emrData: decryptResponse.data.plaintext,
  };
};

exports.addNewEMR = async (data) => {
  const { userType, tokenID, hospitalID, resource_type, EMR_Value } = data;

  if (!userType || !tokenID || !hospitalID || !resource_type || !EMR_Value) {
    throw new Error(
      "Missing required fields: userType, tokenID, hospitalID, resource_type, EMR_Value"
    );
  }

  const permissionGranted = await permissionService.verifyPermissions({
    userType,
    tokenID,
    hospitalID,
    permission: PERMISSIONS.WRITE_EMR,
  });

  if (!permissionGranted) {
    throw new Error("Permissions not granted for adding new EMR.");
  }

  const { capsule, ciphertext } = await _encryptEMR(
    PATIENT_ID_CONSTANT,
    EMR_Value
  );

  await _generateKFrags(PATIENT_ID_CONSTANT, [DOCTOR_ID_CONSTANT]);

  const resource_id = uuidv4();

  const insertQuery = `
    INSERT INTO fhir_resources (resource_id, resource_type, version_id, data)
    VALUES (?, ?, ?, ?)
  `;

  const encryptedEMRData = JSON.stringify({ capsule, ciphertext });

  const checkIntegrity = await this.checkIntegrity(resource_id);
  if (!checkIntegrity.isValid) {
    throw new Error("EMRs integrity check failed.");
  }

  await cassandraClient.execute(
    insertQuery,
    [resource_id, resource_type, "1", encryptedEMRData],
    { prepare: true }
  );

  const newRoot = await blockchainService.updateMerkleRoot(cassandraClient);

  return {
    success: true,
    message: "New EMR added and encrypted successfully",
    resource_id,
    newRoot,
  };
};

exports.checkIntegrity = async (EMR_id) => {
  try {
    if (!EMR_id) {
      throw new Error("EMR_id is required for integrity check.");
    }

    const query =
      "SELECT data FROM fhir_resources WHERE resource_id = ? AND version_id = ? ALLOW FILTERING";
    const result = await cassandraClient.execute(query, [EMR_id, 1], {
      prepare: true,
    });

    if (result.rows.length === 0) {
      throw new Error("EMR not found.");
    }

    const EMRData = result.rows[0].data;
    const leafNode = keccak256(EMRData);

    const allEMRQuery = "SELECT data FROM fhir_resources";
    const allEMRResult = await cassandraClient.execute(allEMRQuery);
    const EMRValuesArray = allEMRResult.rows.map((row) => row.data);

    const leafNodes = EMRValuesArray.map((EMR) => keccak256(EMR));

    const merkleTree = new MerkleTree(leafNodes, keccak256, {
      sortPairs: true,
    });

    const leafIndex = EMRValuesArray.findIndex((data) => data === EMRData);

    if (leafIndex === -1) {
      throw new Error("Leaf node not found in tree.");
    }

    const proofBuffer = merkleTree.getProof(leafNodes[leafIndex]);

    const proof = proofBuffer.map((item) => "0x" + item.data.toString("hex"));

    const leafHex = "0x" + leafNode.toString("hex");

    const isValid = await web3Config.merkleTreeContract.methods
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
