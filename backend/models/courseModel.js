// backend/models/courseModel.js
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  course_id: String,
  course_name: String,
  
});

module.exports = mongoose.model('Course', courseSchema);
