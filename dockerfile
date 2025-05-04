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

# Create an empty data.db file
RUN touch data.db

# Define default command to run the application
CMD ["npm", "start"]
