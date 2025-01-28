// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../node_modules/@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../node_modules/@openzeppelin/contracts/utils/Strings.sol";

contract HospitalToken is ERC1155 {
    using Strings for uint256;

    uint256 constant Doctor = 1;
    uint256 constant Patient = 2;
    uint256 constant Assistant = 3;

    address private _owner;

    modifier onlyOwner() {
        require(msg.sender == _owner, "Caller is not the owner");
        _;
    }

    constructor() ERC1155("https://ipfs.io/ipfs/bafybeihjjkwdrxxjnuwevlqtqmh3iegcadc32sio4wmo7bv2gbf34qs34a/{id}.json") {
        _owner = msg.sender; // The owner is set as the deployer of the contract
    }

    // Access rights within each Hospital
    struct HospitalAccess {
        uint256 hospitalId;
        bytes32 permissionsHash;
    }

    mapping(uint256 => mapping(uint256 => HospitalAccess[])) public tokenHospitalAccessRights;

    // Data associated with every person
    struct PersonalData {
        string name;
        string surname;
        string taxCode;
    }
    
    mapping(uint256 => mapping(uint256 => PersonalData)) public tokenPersonalData;  // userType , tokenID -> personalData
    mapping(uint256 => mapping(uint256 => address)) private addressTokenPossession; // userType , tokenID -> address

    mapping(address => mapping(uint256 => uint256)) private tokenPossession; //  address , userType -> tokenID

    uint256 private tokenIdDoctor = 0;
    uint256 private tokenIdPatient = 0;
    uint256 private tokenIdAssistant = 0;

    // Define hospital identifiers as constants
    uint256 private constant H1 = 1;
    uint256 private constant H2 = 2;
    uint256 private constant H3 = 3;
    uint256 private constant H4 = 4;

    // Define constants for each permission bit
    uint8 constant PERMISSION_READ_HISTORY = 0x01;
    uint8 constant PERMISSION_READ_PRESCRIPTIONS = 0x02;
    uint8 constant PERMISSION_READ_TEST_RESULTS = 0x04;
    uint8 constant PERMISSION_UPDATE_EMR = 0x08;  // Example new permission bit for updating EMR
    uint8 constant PERMISSION_RADIOLOGY_ROOM = 0x10;
    uint8 constant PERMISSION_CARDIOLOGY_ROOM = 0x20;

    // Functions to mint tokens for doctors, assistants, and patients
    function mintDoctor(address account, string memory name, string memory surname, string calldata taxCode) public onlyOwner {
        require(balanceOf(account, Doctor) == 0, "This address already owns this token type.");
        tokenIdDoctor++;
        _mint(account, Doctor, 1, "");
        tokenPersonalData[Doctor][tokenIdDoctor] = PersonalData(name, surname, taxCode);
        tokenPossession[account][Doctor] = tokenIdDoctor;
        addressTokenPossession[Doctor][tokenIdDoctor] = account;
        // Initialize with empty permissions
        initializeHospitalAccess(Doctor, tokenIdDoctor);
    }

    function mintPatient(address account, string memory name, string memory surname, string calldata taxCode) public onlyOwner {
        require(balanceOf(account, Patient) == 0, "This address already owns this token type.");
        tokenIdPatient++;
        _mint(account, Patient, 1, "");
        tokenPersonalData[Patient][tokenIdPatient] = PersonalData(name, surname, taxCode);
        tokenPossession[account][Patient] = tokenIdPatient;
        addressTokenPossession[Patient][tokenIdPatient] = account;
        // Initialize with empty permissions
        initializeHospitalAccess(Patient, tokenIdPatient);
    }

    function mintAssistant(address account, string memory name, string memory surname, string calldata taxCode) public onlyOwner {
        require(balanceOf(account, Assistant) == 0, "This address already owns this token type.");
        tokenIdAssistant++;
        _mint(account, Assistant, 1, "");
        tokenPersonalData[Assistant][tokenIdAssistant] = PersonalData(name, surname, taxCode);
        tokenPossession[account][Assistant] = tokenIdAssistant;
        addressTokenPossession[Assistant][tokenIdAssistant] = account;
        // Initialize with empty permissions
        initializeHospitalAccess(Assistant, tokenIdAssistant);
    }

    // Function used to retrieve information about the last user minted
    function getLastMintedUser(uint256 tokenType, address accountOwner) public view returns (address account, uint256 tokenId, string memory name, string memory surname, string memory taxCode) {
        uint256 tokenID;
        require(balanceOf(accountOwner, tokenType) > 0, "Address does not own this token type.");

        tokenID = tokenPossession[accountOwner][tokenType];

        return (accountOwner, tokenID, tokenPersonalData[tokenType][tokenID].name, tokenPersonalData[tokenType][tokenID].surname, tokenPersonalData[tokenType][tokenID].taxCode);
    }

    // Function used to initialize the array containing permissions for each Hospital (Sets permission to empty hash for each hospital)
    function initializeHospitalAccess(uint256 tokenType, uint256 tokenID) internal {
        // Iterate over each hospital ID
        for (uint256 i = H1; i <= H4; i++) {
            // Initialize access rights for this token at the given index for each hospital
            tokenHospitalAccessRights[tokenType][tokenID].push(HospitalAccess({
                hospitalId: i,
                permissionsHash: bytes32(0) // Empty permissions hash
            }));
        }
    }

    // Function used to update hospital access rights for a specific token instance
    function setHospitalAccess(uint256 tokenType, uint256 tokenID, uint256 hospitalId, bytes32 permissionsHash) public onlyOwner {
        address owner = addressTokenPossession[tokenType][tokenID];
        // require(owner != address(0), "Token does not exist or has no owner.");

        // Find and update the specific hospital access rights for the given token instance
        bool hospitalFound = false;
        for (uint256 i = 0; i < tokenHospitalAccessRights[tokenType][tokenID].length; i++) {
            if (tokenHospitalAccessRights[tokenType][tokenID][i].hospitalId == hospitalId) {
                tokenHospitalAccessRights[tokenType][tokenID][i].permissionsHash = permissionsHash;
                hospitalFound = true;
                break;
            }
        }

        // If the hospital ID is not found, add a new entry
        if (!hospitalFound) {
            tokenHospitalAccessRights[tokenType][tokenID].push(HospitalAccess({
                hospitalId: hospitalId,
                permissionsHash: permissionsHash
            }));
        }
    }

    // Returns the permissions hash for a specified hospital associated with a specific token
    function getHospitalPermissionsHash(uint256 tokenType, uint256 tokenID, uint256 hospitalId) public view returns (bytes32) {
        address owner = addressTokenPossession[tokenType][tokenID];
        // require(owner != address(0), "Token does not exist or has no owner.");

        for (uint256 i = 0; i < tokenHospitalAccessRights[tokenType][tokenID].length; i++) {
            if (tokenHospitalAccessRights[tokenType][tokenID][i].hospitalId == hospitalId) {
                return tokenHospitalAccessRights[tokenType][tokenID][i].permissionsHash;
            }
        }
        // Return 0 if no permissions are set or if the hospitalId is not found
        return bytes32(0);
    }

    function getAddressForToken(uint256 tokenType, uint256 tokenID) public view returns (address) {
        address owner = addressTokenPossession[tokenType][tokenID];
        require(owner != address(0), "Token does not exist or has no owner.");
        return owner;
    }

    // Function to transfer ownership
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is the zero address");
        _owner = newOwner;
    }

    // Function to retrieve the current owner
    function owner() public view returns (address) {
        return _owner;
    }
}