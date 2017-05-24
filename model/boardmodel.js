/**
 * Created by kuvshinov on 16. 8. 4.
 */
const mongoose = require('mongoose');
const db = require('../model/db');
const ai = require('mongoose-auto-increment');

ai.initialize(db);

var BoardSchema = new mongoose.Schema({
    title: String,
    unittest: String,
    subject: String,
    date: String,
    content: String,
    submit_form: String,
    writer: String,
    attachment: String,
    regdate: {
        type: Date,
        default: Date.now
    }
});

var UserSchema = new mongoose.Schema({
    idx: Number,
    id: String,
    pw: String,
    email: String,
    name: String,
    hakbun: Number,
    perm: Boolean
});

var UploadSchema = new mongoose.Schema({
    idx: Number,
    uploader: String,
    regdate: {
        type: Date
    }
});

BoardSchema.plugin(ai.plugin, {
    "model": 'Board',
    "field": "idx",
    "startAt": 1,
    "incrementBy": 1
});

// DB 스키마 컴파일링 시작.
var Board = mongoose.model('Board', BoardSchema);
var User = mongoose.model('User', UserSchema);
var Upload = mongoose.model('Upload', UploadSchema);
// DB 스키마 컴파일링 종료.

module.exports = Board;
module.exports = User;
module.exports = Upload;