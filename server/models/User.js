const mongoose = require("mongoose");
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Name can not be empty'],
      maxlength: 30,
      minlength: 3,
    },
    email: {
      type: String,
      required: [true, 'Please provide email address'],
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        'Please provide a valid email',
      ],
      unique: true,
    },
    // ?  how can password be more secure
    password: {
      type: String,
      required: [true, 'Password can not be empty'],
      minlength: 6,
    },
  })

  userSchema.methods.createJWT = function () {
    return jwt.sign(
      { userId: this._id },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRATION,
      }
    )
  }



userSchema.pre('save', async function () {
  const salt = await bcrypt.genSalt(10) 
  this.password = await bcrypt.hash(this.password, salt)
})



userSchema.methods.verifyPassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
}

module.exports = mongoose.model('User', userSchema);



