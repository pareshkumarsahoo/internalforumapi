const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Question = require("../models/questiondata");
const User = require("../models/users");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const keys = require("../config/keys");
const sendgrid = require("@sendgrid/mail");

sendgrid.setApiKey(process.env.SENDER_GRID_API);
//FOR TESTING
router.get("/", async (req, res) => {
  res.send("<h1>Internal Forum API !</h1>");
});

//VERIFYING THE BEARER TOKEN FOR AUTHRIZATION
function verifyToken(req, res, next) {
  const bearerHeader = req.headers["authorization"];

  if (typeof bearerHeader !== "undefined") {
    const token = bearerHeader.split(" ");
    req.token = token[1];
    next();
  } else {
    res.sendStatus(403);
  }
}

// post question
router.post("/post/question", verifyToken, async (req, res) => {
  //  userID, userName comes from localstorage / cookies
  const { userID, userName, title, body, tags } = req.body;

  if (!userID || !userName || !title || !body || !tags)
    return res.status(400).json({ message: "All fild are required .." });

  try {
    const postData = await new Question({
      userID,
      userName,
      title,
      body,
      tags,
    });

    const Usernewdata = await postData.save();

    res.status(201).json(Usernewdata);
  } catch (error) {
    res.status(400).json({ message: error });
  }
});

// delete question
router.delete("/delete/:id", async (req, res) => {
  try {
    await Question.findByIdAndDelete({ _id: req.params.id });
    res.status(204).json({ message: "question deleted" });
  } catch (error) {
    res.status(400).json({ message: error });
  }
});

// post answers
router.post("/post/answer/:id", async (req, res) => {
  const { answeredUserID, answeredUserName, answer } = req.body;

  if (!answeredUserID || !answeredUserName || !answer)
    return res.status(400).json({ message: "All fild are required .." });

  const responce = await Question.findOne({ _id: req.params.id }); // question id

  if (responce) {
    const ans = await responce.addanswers(
      answeredUserID,
      answeredUserName,
      answer
    );
    await responce.save();
    res.status(201).send(ans);
  }
});

// ---------------------------------------------DELETE ANSWER ------------------------------------------------
//DELETE ANSWER OF A QUESTION " URL :{endpoint}/question/<questionID>/delete/<answerID>"
// NOTE: only let the creater of answer can delete the answer.(HIDE FROM FRONT-END)
// DELETE

router.delete(
  "/question/:questionID/delete/:answerID",
  verifyToken,
  (req, res) => {
    jwt.verify(req.token, keys.jwtSecretKey, (err, authData) => {
      if (err) {
        return res.sendStatus(403);
      } else {
        var qID = req.params.questionID;
        var aID = req.params.answerID;

        Question.updateOne(
          { _id: qID },
          { $pull: { answers: { _id: aID } } },
          { safe: true }
        )
          .then((data) => {
            if (!data) {
              return res.sendStatus(404);
            } else {
              return res.status(200).send("DELETED!");
            }
          })
          .catch((err) => {
            return res.status(404).send(err);
          });
      }
    });
  }
);

// --------------------------------------------------------GET QUESTIONS BY USER----------------------------------------------------------
//CHANGE STATUS OF A QUESTION " URL :{endpoint}/questions/<USERID> "

router.get("/questions/:userId", verifyToken, (req, res) => {
  jwt.verify(req.token, keys.jwtSecretKey, (err, authData) => {
    if (err) {
      return res.sendStatus(403);
    } else {
      console.log(req.params.userId);

      Question.find({ userID: req.params.userId })
        .then((data) => {
          console.log(data);
          if (data.length > 0) {
            return res.status(200).json({
              status: true,
              message: "Succesful",
              data: data,
            });
          } else {
            return res.status(404).json({
              status: false,
              message: "No Questions Yet.",
            });
          }
        })
        .catch((err) => {
          return res.status(404).send(err);
        });
    }
  });
});

// ---------------------------------------------CHANGE STATUS ------------------------------------------------
//CHANGE STATUS OF A QUESTION " URL :{endpoint}/questions/status/<questionID>?isSolved=<true || false> "
// NOTE: pass only boolean value in the status param
// PUT

router.put("/question/status/:id/:status", (req, res) => {
  var isSolved = req.params.status;
  const options = { new: true };

  Question.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { isSolved: isSolved } },
    options
  )
    .then((question) => {
      return res.status(200).json({
        status: true,
        message: "Updated SUccesfully",
        data: question,
      });
    })
    .catch((err) => {
      return res.status(404).json({
        status: false,
        message: "Wrong Parameter Passed",
        errorMessage: err,
      });
    });
});
//  ----------- GET A ONLY ONE PARTICULAR QUESTION BY ID------------------------
//  URL :{endpoint}api/get/allposts/questionId/:id

router.get("/get/allposts/questionId/:id", async (req, res) => {
  try {
    const questionItem = await Question.find({ _id: req.params.id });
    res.status(200).send(questionItem);
  } catch (error) {
    res.sendStatus(403);
  }
});

// ---------GET ALL QUESTIONS THROUGH USERID----------------
router.get("/get/users/askquestion/:userid", verifyToken, async (req, res) => {
  jwt.verify(req.token, keys.jwtSecretKey, async (err, authData) => {
    if (err) {
      return res.sendStatus(403);
    } else {
      try {
        const askquestion = await Question.find({ userID: req.params.userid });
        res.status(200).send(askquestion);
      } catch (error) {
        res.sendStatus(403);
      }
    }
  });
});

// ---------------------------------------------GET ALL POST BY STATUS ------------------------------------------------
//GET ALL QUESTIONS " URL :{endpoint}/get/allposts/<unsolved || solved || all> "
// NOTE: anything else than solved and unsolved will give all the data
// GET

router.get("/get/allposts/:status", (req, res) => {
  let queryObj = {};

  if (req.params.status === "solved") {
    queryObj = { isSolved: true };
  } else if (req.params.status === "unsolved") {
    queryObj = { isSolved: false };
  } else {
    queryObj = {};
  }

  Question.find(queryObj, (err, data) => {
    if (err) {
      return res.status(500).send(err);
    } else {
      return res.status(200).json({
        status: true,
        data: data,
      });
    }
  });
});

// ---------------------------------------------------------SEARCH API----------------------------------------------------------

//SEARCH BY TITLE " URL :{endpoint}/api/questions?search=<YOUR_TEXT> "
// NOTE: you can search by the entire title or some words of the title
// GET

router.get("/questions", verifyToken, (req, res) => {
  jwt.verify(req.token, keys.jwtSecretKey, (err, authData) => {
    if (err) {
      return res.sendStatus(403);
    } else {
      var searchText = req.query.search;
      const regex = new RegExp(searchText, "i"); // i for case insensitive
      Question.find({ title: { $regex: regex } }, (err, result) => {
        if (err) {
          return res.status(500).send(err);
        } else {
          res.status(200).json({
            status: true,
            data: result,
          });
        }
      });
    }
  });
});

// ---------------------------------------------------------GET BY TAGS----------------------------------------------------------

//GET QUESTIONS BY TAG " URL :{endpoint}/api/get/questions/<YOUR_TAG>"
// NOTE: tag will be searched in  case insensitivty
// GET

router.get("/get/questions/:tag", verifyToken, (req, res) => {
  jwt.verify(req.token, keys.jwtSecretKey, (err, authData) => {
    if (err) {
      return res.sendStatus(403);
    } else {
      const tag = req.params.tag;
      const regex = new RegExp(tag, "i"); // i for case insensitive

      Question.find({ tags: { $regex: regex } })
        .then((questions) => {
          if (questions.length < 1) {
            return res.status(404).json({
              status: false,
              message: "No results found!",
            });
          }
          return res.status(200).send(questions);
        })
        .catch((err) => {
          return res.status(404).send(err);
        });
    }
  });
});

// ----------- GET USER DATA-----------
// " URL :{endpoint}/get/users"

router.get("/get/users", verifyToken, async (req, res) => {
  jwt.verify(req.token, keys.jwtSecretKey, async (err, authData) => {
    if (err) {
      return res.sendStatus(403);
    } else {
      try {
        const UserData = await User.find();
        return res.status(200).send(UserData);
      } catch (error) {
        return res.sendStatus(403);
      }
    }
  });
});

// ------------------------------------------- AUTHENTICAITON -------------------------------------------------------------------
//CREATE A NEW USER " URL :{endpoint}/api/register "
/*
  POST
  req body = ({
    userName:string,
    email:string,
    password:string
  })

*/

router.post("/register", async (req, res) => {
  User.find({ email: req.body.email })
    .exec()
    .then((users) => {
      if (users.length > 0) {
        return res.status(409).json({
          message: "Auth Failed! Email already Registered!",
        });
      } else {
        bcrypt.hash(req.body.password, 10, (err, hash) => {
          if (err) {
            return res.status(500).json({
              error: err,
            });
          } else {
            const newUser = new User({
              _id: new mongoose.Types.ObjectId(),
              userName: req.body.userName,
              email: req.body.email,
              password: hash,
            });
            newUser
              .save()
              .then((result) => {
                return res.status(201).json({
                  status: true,
                  message: "Registered Succesfully!",
                });
              })
              .catch((err) => {
                return res.status(500).json({
                  status: false,
                  message: err,
                });
              });
          }
        });
      }
    });
});

//SIGN-IN A NEW USER "  URL :{endpoint}/api/login "
/*
  POST
  req body = ({
    email:string,
    password:string
  })

*/

router.post("/login", async (req, res) => {
  User.find({ email: req.body.email })
    .exec()
    .then((users) => {
      if (users.length < 1) {
        return res.status(401).json({
          status: true,
          message:
            "This email is not Registered! Try loging-in with a registred email.",
        });
      } else {
        bcrypt.compare(req.body.password, users[0].password, (err, result) => {
          if (err) {
            return res.status(401).json({
              message: "Auth Failed!",
            });
          }
          if (result) {
            const token = jwt.sign(
              {
                userName: users[0].userName,
                userID: users[0]._id,
              },
              keys.jwtSecretKey
            );
            return res.status(200).json({
              status: true,
              message: "Login Succesfull!",
              token: token,
              userID: users[0]._id,
              userName: users[0].userName,
            });
          }

          return res.status(401).json({
            message: "Auth Failed!",
          });
        });
      }
    })
    .catch();
});

router.post("/forgotpassword", async (req, res) => {
  User.find({ email: req.body.email })
    .exec()
    .then((users) => {
      if (users.length < 1) {
        return res.status(401).json({
          status: false,
          message: "This email is not Registered! ",
        });
      } else {
        const mail = {
          to: req.body.email, // Change to your recipient
          from: "paresh.sahoo@invincix.com", // Change to your verified sender
          subject: "Reset Password",
          text: "Please Tap on the follwing link to reset your password.",
          html: '<button><a href="www.facebook.com" >Reset Password</a></button>',
        };

        sendgrid
          .send(mail)
          .then(() => {
            console.log("Email sent");
            return res.status(200).json({
              status: true,
              message:'Check your mail.'
            })
          })
          .catch((error) => {
            console.log(error);
          });
      }
    });
});

module.exports = router;
