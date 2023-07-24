# Usage

To get started, follow these steps:

1. Create a new directory and place a `.env` file inside it. This `.env` file will store the configuration settings for your deployment.

   ```text
   SOURCE_HOST=                  # The hostname of the source server
   SOURCE_PORT=22                # The SSH port of the source server
   SOURCE_USER=                  # The SSH username for the source server
   SOURCE_WP=/var/www/site       # The path to the WordPress directory on the source server
   SOURCE_PRIVATE_KEY="..."      # The private SSH key for authentication to the source server
   TARGET_HOST=                  # The hostname of the target server
   TARGET_PORT=22                # The SSH port of the target server
   TARGET_USER=                  # The SSH username for the target server
   TARGET_WP=/var/www/site       # The path to the WordPress directory on the target server
   TARGET_PRIVATE_KEY="..."      # The private SSH key for authentication to the target server
   ```

2. Replace the placeholders with the appropriate values for your source and target servers, including the SSH connection details and file paths.

3. Open your terminal or command prompt and navigate to the directory where you created the `.env` file.

4. Run the following command to execute the deployment process:

   ```bash
   npx wpdeploy
   ```
