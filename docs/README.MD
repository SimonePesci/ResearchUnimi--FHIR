# Database Documentation

## Database Schema and Examples

The system utilizes an Apache Cassandra database for off-chain storage. Below are the key tables and example records.

---

### Table: `fhir_resources`

This table stores all FHIR resources, such as Patient records, Prescriptions, and Observations. Each resource is stored as a JSON-like string.

- **Purpose**: To maintain the raw medical data in a structured, interoperable format (FHIR).
- **Example Record**:
  ```json
  {
    "resource_id": "example-patient-1",
    "data": {
      "capsule": "Ak5B17UNN+rqnQWf/MYHzpEsxHAAJNLASEeS4hAlwiHXAs1mmjz5Y2rk9KT7W0bGhnAxFTm2yWT/j7CWvgpAqwn1OFulnVSLVpY3cjYiR2uhC8Ha00BCKUvE1XaN1eP7nYE=",
      "ciphertext": "bPAYDuo+r2NyNECOQ2hDBZrSMB8q3JJz1doXqc9SsfAyLVQc8fFbmU7XNhqZ8jIkmk9h1rjnshOyAbAfqT6xMYwQL5xd1HVdjQ1I32QyHoaqHAYFWvE4hdXRuZeU7uQ+Mt+Jmcs89OwB4AgPHBRfP3OuITdKnXYnKMzATw7WwEZxffr3tX63lMmgbgYoy+zLsZWxTvvh8jfHCFT9QYzwdLVGN9upfzcanH4Mam8o9ZM6ub9U6/8StynpV1HRn+RIBaR/nHrwSxuaUTPa7ZgsJ3CmN7lHsKlPLIt1nk0kCf78jIT7B3qpFnR8AiThWyxzefoy59mPk5r2holmZgxgeCToyuo4JZADuf+2zk3vYix1VIwnLOGLJK96Y9fFPc1f+Osh/SQZYee12QuMXLFbJdhTp3RmkMZrmtayHP3mVZuhM6lv6iie5WwhoeNmxddUSfLp2CblsGvujPx7d5mjUa6XJzHFNAer68GGjkBCHhyCX2PRRQ=="
    },
    "resource_type": "Patient",
    "version_id": 1
  }

### Table: `permissions`

This table stores the access control permissions for each user role and token. The permissions themselves are stored as a serialized JSON array.

- **Purpose**: To maintain the raw medical data in a structured, interoperable format (FHIR).
- **Example Record**:
```json
{
  "userType": "doctor",
  "tokenID": "1",
  "hospitalID": "1",
  "permission": [
    "READ_EMR",
    "WRITE_EMR",
    "ACCESS_RADIOLOGY"
  ]
}
```
      
