# Use the official Node.js LTS image
FROM node:20

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package*.json ./

# Install dependencies, omitting optional ones
RUN npm install --omit=optional

# Copy the rest of the application code
COPY . .

# Create a directory for the database file
# Workaround for the volume mount, as docker only allows mounting directories, not files
RUN mkdir -p /app/data

# Create an empty data.db file
RUN touch /app/data/data.db

# Create a symbolic link to the data.db file in the app directory
RUN ln -s /app/data/data.db /app/data.db

# Define default command to run the application
CMD ["npm", "start"]
