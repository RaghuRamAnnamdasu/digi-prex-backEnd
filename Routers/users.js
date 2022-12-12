import express from "express";
import {createUSer, getUserByName} from "./helper.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { client } from "../index.js";
import { ObjectId } from "bson";

const router = express.Router();

async function genHashedPassword(password){
    const no_of_rounds = 10;
    const salt = await bcrypt.genSalt(no_of_rounds);
    const hashedPassword = await bcrypt.hash(password,salt);
    return hashedPassword;
  }

router.post('/signup', async function (req, res) {
    const {email,password,userName} = req.body[0];
    console.log(req.body);
    console.log(email,password,userName);
    const userFromDB = await getUserByName(email);

      if(userFromDB){
        res.status(400).send({"message" : "Email already exists", "emailError": true});
      }else if(password.length < 8){
        res.status(400).send({"message" : "Password should be minimum of 8 characters", "passwordError": true});
      }else{
        if(email === "admin@gmail.com"){
          const hashedPassword = await genHashedPassword(password);
          const result = await createUSer({email : email , password : hashedPassword, userName: userName, type : "admin"});
          console.log(hashedPassword);
          res.send(result);
        }else{
          const hashedPassword = await genHashedPassword(password);
          const result = await createUSer({email : email , password : hashedPassword, userName: userName, type : "user", cart: [], orderedItems:[], notificationArray:[]});
          console.log(hashedPassword);
          res.send(result);
        }
      }
  })


  router.post('/login',async function (req, res) {

    
      const {email,password} = req.body[0];
      const userFromDB = await getUserByName(email);
    //   console.log(userFromDB);
      var passwordMatch;
      if(userFromDB){
        const storedPassword = userFromDB.password;
        passwordMatch = await bcrypt.compare(password,storedPassword);
        // console.log(passwordMatch);
      }
    

      if(!userFromDB){
        res.status(401).send({"message" : "Invalid Credentials"});
      }else if(!passwordMatch){
        res.status(401).send({"message" : "Invalid Credentials"});
      }else{
        const token = jwt.sign({id : userFromDB._id},process.env.secretKey);
        res.send({"message" : "Successful Login", token : token, name: userFromDB.userName, id: userFromDB._id, email: userFromDB.email, 
        type: userFromDB.type, cart: userFromDB.cart, orderedItems: userFromDB.orderedItems, 
        notificationArray: userFromDB.notificationArray });
        // console.log(res.name,req.body[0]);
      }
  })    



  router.post('/forgotpassword', async function(req, res) {
    // console.log("entered in to forgotpassword route")
    const {email} = req.body[0];
    const userFromDB = await getUserByName(email);
    console.log(userFromDB);

      if(!userFromDB){
        res.status(401).send({"message" : "Email does not exists"});
      }else{
      //  const secret = process.env.secretKey + userFromDB.password;
        const secret = process.env.secretKey;
        const payload = {
            email : userFromDB.email,
            id : userFromDB._id
        }
        const token = jwt.sign(payload,secret,{expiresIn: '15m'});
        const link = `${process.env.frontEndUrl}/reset-password/${userFromDB._id}/${token}`;
        // console.log(link);
        mailer(email,link);
        const result = await client.db("digi-prex-shopping").collection("users").updateOne({email : email},{$set : {resetToken : token}});
        // console.log(result);
        res.send({"message" : "Password rest link has sent to your mail", result});
      }
  })


  router.post("/resetPassword", async function(req,res){
    
    const {id, password, token} = req.body[0];
    // console.log(req.body[0],id, password, token);
    const userDetails = await client.db("digi-prex-shopping").collection("users").find({_id : ObjectId(id)}).toArray();
    // console.log(userDetails);
    const resetToken = userDetails[0].resetToken;

    jwt.verify(token,process.env.secretKey,async function(err,decodedData){
      if(err){
        console.log("error",err);
        return res.status(401).send({message : "Authentication Error or Link expired"});
      }else if(token === resetToken){
        const hashedPassword = await genHashedPassword(password);
        console.log("hashedPassword", hashedPassword)
        const result = await client.db("digi-prex-shopping").collection("users").updateOne({_id : ObjectId(id)},{$set : {password : hashedPassword}});
        res.send({message : "Successful Reset", result});
      }else{
        res.status(401).send({message : "Authentication Error or Link got broken"})
      }
    });

  })



  export const userRouter = router;


  function mailer(email,link){
    var transporter = nodemailer.createTransport({
        service: "outlook",
        auth: {
            user: "coderatwork@outlook.com",
            pass: process.env.password
        }
    });
    console.log("My pass: ",process.env.password);
    var mailOptions = {
        from: "coderatwork@outlook.com",
        to: email,
        subject: "Reset Password - Digi-Prex Shopping Cart",
        text: "Hi User",
        // html: "<div><h4>Hi User,<h4></br><p>please click the link below for password reset</p></br><a href={link}/> </div>"
        html: `please click the link to reset your password - ${link}`
      }

    transporter.sendMail(mailOptions,function(error,info){
        if(error){
            console.log(error);
        }else{
            console.log(`Email sent:`+info.response)
        }
    })
}