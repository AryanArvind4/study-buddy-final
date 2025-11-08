// userModel.js
const mongoose = require('mongoose');

// Define the User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true, // The name field is required
  },
  email: {
    type: String,
    required: true, // The email field is required
    unique: true,   // Ensure emails are unique across users
  },
  course_id: {
    type: String,
    required: true, // The course ID is required
  },
  study_spot: {
    type: String,
    required: false, // Study spot is optional
  },
  study_time: {
    type: String,
    required: false, // Study time is optional
  },
});

// Create the User model from the schema
const User = mongoose.model('User', userSchema);

module.exports = User; // Export the model to use it in other parts of the application
