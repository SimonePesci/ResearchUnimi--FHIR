const cassandraClient = require("../config/cassandra");
const { hashPermissions } = require("../utils/helpers");
const keccak256 = require("keccak256");
const { web3Config } = require("../config/web3");

exports.assignPermission = async (data) => {
  const { userType, tokenID, hospitalID, permissions } = data;
  const { hospitalTokenContract, owner } = web3Config;

  let tokenType;
  if (userType === "doctor") tokenType = 1;
  else if (userType === "patient") tokenType = 2;
  else if (userType === "assistant") tokenType = 3;
  else throw new Error("Invalid userType");

  const permissionsHash = hashPermissions(permissions);

  await setHospitalAccess(tokenType, tokenID, hospitalID, permissionsHash);

  await storePermissionsOffChain(userType, tokenID, hospitalID, permissions);
};

async function setHospitalAccess(
  tokenType,
  tokenID,
  hospitalID,
  permissionsHash
) {
  const { hospitalTokenContract, owner } = web3Config;
  if (!hospitalTokenContract || !hospitalTokenContract.methods) {
    throw new Error("HospitalToken contract is not initialized.");
  }

  await hospitalTokenContract.methods
    .setHospitalAccess(tokenType, tokenID, hospitalID, permissionsHash)
    .send({ from: owner, gas: 5000000 });
}

async function storePermissionsOffChain(
  userType,
  tokenID,
  hospitalID,
  permissions
) {
  const query = `
    INSERT INTO user_permissions (user_type, token_id, hospital_id, permissions)
    VALUES (?, ?, ?, ?)
  `;
  const params = [userType, tokenID, hospitalID, JSON.stringify(permissions)];
  await cassandraClient.execute(query, params, { prepare: true });
}

exports.verifyPermissions = async (query) => {
  const { userType, tokenID, hospitalID, permissions } = query;
  const { hospitalTokenContract } = web3Config;

  if (!permissions) {
    throw new Error("Permission to check is not provided.");
  }

  let tokenType;
  if (userType === "doctor") tokenType = 1;
  else if (userType === "patient") tokenType = 2;
  else if (userType === "assistant") tokenType = 3;
  else throw new Error("Invalid userType");

  const offChainPermissions = await getPermissionsOffChain(
    userType,
    tokenID,
    hospitalID
  );

  if (!offChainPermissions) {
    console.error("No permissions found for the specified user.");
    throw new Error("No permissions found for the specified user.");
  }

  const calculatedHash =
    "0x" + keccak256(JSON.stringify(offChainPermissions)).toString("hex");

  console.log("calculatedHash", calculatedHash);

  const onChainHash = await hospitalTokenContract.methods
    .getHospitalPermissionsHash(tokenType, tokenID, hospitalID)
    .call();

  if (calculatedHash !== onChainHash) {
    console.error("Permissions integrity check failed.");
    throw new Error("Permissions integrity check failed.");
  }

  const hasPermission = offChainPermissions.includes(permission);

  console.log(`User has permission '${permission}':`, hasPermission);

  return hasPermission;
};

async function getPermissionsOffChain(userType, tokenID, hospitalID) {
  const query = `
      SELECT permissions
      FROM user_permissions
      WHERE user_type = ? AND token_id = ? AND hospital_id = ?
    `;
  const params = [userType, tokenID, hospitalID];
  const result = await cassandraClient.execute(query, params, {
    prepare: true,
  });

  if (result.rows.length === 0) {
    return null;
  }

  return JSON.parse(result.rows[0].permissions);
}
