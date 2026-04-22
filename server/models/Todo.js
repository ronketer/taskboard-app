const mongoose = require("mongoose");


const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title can not be empty. Please enter a title!'],
    maxlength: 50,
    minlength: 3,
  },
  description: {
    type: String
  },
  createdBy: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: [true, 'User name must be provided!'],
  },
  id: {
    type: Number,
    unique: true,
  },
}, { timestamps: true }); // adds 2 fields: createdAt, 

// increment id before saving
todoSchema.pre('save', async function (next) {
  if (this.isNew) {
    const lastTodo = await this.constructor.findOne().sort('-id');
    // if todo list empty, start from 1
    if (!lastTodo) {
      this.id = 1;
    } else {
      this.id = lastTodo.id + 1;
    }
  }

  // do we have to call next() here, even if function is a async 
  next(); 
});

module.exports = mongoose.model('Todo', todoSchema);



