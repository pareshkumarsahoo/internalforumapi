'use strict';

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
const bodyParser = require("body-parser");

//Bodyparser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const PORT = process.env.PORT || 5000;
// cors middleware
const corsConfig = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
};
app.use(corsConfig);

app.options('*', cors());
const Routes = require("./routes/Routes");
const db = require("./config/keys");
mongoose
  .connect(db.mongodbURL, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log("connection successfully ...");
  })
  .catch((err) => console.log("Internal server Error"+err));

app.use("/api", Routes);

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
