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
app.use(cors());
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
