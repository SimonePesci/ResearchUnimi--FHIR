# Database Documentation

## Database Schema and Examples

The system utilizes an Apache Cassandra database for off-chain storage. Below are the key tables and example records.

### Table: `fhir_resources`

This table stores all FHIR resources, such as Patient records, Prescriptions, and Observations. Each resource is stored as a JSON-like string.

-   **Purpose**: To maintain the raw medical data in a structured, interoperable format (FHIR).
-   **Example Record**:
    ```sql
    {
      "resource_type": "Patient",
      "resource_id": "example-patient-1",
      "version_id": "1",
      "data": "{\"resourceType\":\"Patient\",\"id\":\"example-patient-1\",\"meta\":{\"versionId\":\"1\",\"lastUpdated\":\"2023-07-15T12:00:00Z\"},\"name\":[{\"use\":\"official\",\"family\":\"Smith\",\"given\":[\"John\"]}],\"gender\":\"male\",\"birthDate\":\"1970-01-01\",\"address\":[{\"use\":\"home\",\"line\":[\"123 Main St\"],\"city\":\"Anytown\",\"state\":\"CA\",\"postalCode\":\"12345\",\"country\":\"USA\"}]}"
    }
    ```

### Table: `permissions`

This table stores the access control permissions for each user role and token. The permissions themselves are stored as a serialized JSON array.

-   **Purpose**: To manage fine-grained access control policies off-chain for scalability and flexibility.
-   **Example Record**:
    ```sql
    {
      "user_type": "doctor",
      "token_id": "550e8400-e29b-41d4-a716-446655440000",
      "hospital_id": 101,
      "permissions": "[\"READ_EMR\", \"WRITE_EMR\"]"
    }
    ```
