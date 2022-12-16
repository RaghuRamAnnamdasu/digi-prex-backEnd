import { ObjectId } from "bson";
import express from "express";
import Stripe from "stripe";
import { client } from "../index.js";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";

const stripe = new Stripe('sk_test_51LSahvSIYNroY1eRa1OWsxkjQvw2IBqXWbnVJjVMCYmHIb3sjHiFrUJ0ZdbWzBT5JXs4FtTiyppblcRhg31TDFrH00bhTMbTeg');


const router = express.Router();

//get all items for display in UI

router.get("/getAllItems", async (req,res)=>{
    const itemsData = await client.db("digi-prex-shopping").collection("items").find({}).toArray();
    res.send(itemsData);
});


//updating cart after addition or deletion of item to cart

router.put("/updateCartItem/:userId", async (req,res)=>{
    let cartItemsArray = req.body;
    let userId = req.params.userId;

    const replaceCart = await client.db("digi-prex-shopping").collection("users").updateOne({_id : ObjectId(userId)},{$set:{cart : cartItemsArray}});
    res.send(replaceCart);
});


//get cart items for booking page

router.get("/getCart/:userId", async (req,res)=>{
    let userId = req.params.userId;
    const userProfile = await client.db("digi-prex-shopping").collection("users").find({_id : ObjectId(userId)}).toArray();
    let cartItems = [];
    if(userProfile[0].cart.length === 0){
        res.send([]);
    }else{
        userProfile[0].cart && userProfile[0].cart.map(async (itemId,index)=>{
            const result = await client.db("digi-prex-shopping").collection("items").find({_id : ObjectId(itemId)}).toArray();
            cartItems.push(result[0]);
            if(cartItems.length === userProfile[0].cart.length){
                console.log("cartItems........",cartItems); 
                res.send(cartItems);
            }
        });
    }
});


// book an order using stripe payment gateway

router.post("/bookOrder", async (req,res)=>{
    try{
    const {token} = req.body;
    const bookedData = req.body;
    const customer = await stripe.customers.create({
        email: token.email,
        source: token.id
    });

    // console.log("customer......", customer)

    const paymentIntent = await stripe.paymentIntents.create({
        amount: req.body.totalAmount * 100,
        currency: 'inr',
        payment_method_types: ['card'],
        customer : customer.id,
        receipt_email : token.email
    });


    if(paymentIntent){
        req.body.transactionId = paymentIntent.id;
        const bookedDataResult = await client.db("digi-prex-shopping").collection("bookedData").insertOne(bookedData);
        const userId = bookedData.userId;
        const orderedItems = bookedData.cartItems;
        const orderedItemsSavedResult = await client.db("digi-prex-shopping").collection("users").updateOne({_id : ObjectId(userId)},{$push : {orderedItems : {$each : orderedItems}}});
        res.send({message : "Booking Details Successfully updated", type : "success"});
    }else{
        res.status(400).send({message : error.message, type : "error"});
    }
    }catch(error){
        console.log(error);
        res.status(400).send({message : error.message, type : "error"});
    }
});


//send Notification during signOff and tab close


router.get("/sendNotification/:emailId/:userId", async (req,res)=>{

    const {emailId,userId} = req.params;
    const link = `${process.env.frontEndUrl}/bookOrder/fromLink/${userId}`;
    


    async function getCartDetailsAtMoment(){
        let items=[];
        let userProfile = await client.db("digi-prex-shopping").collection("users").find({email : emailId}).toArray();
        if(userProfile[0] && userProfile[0].cart?.length > 0){
            userProfile[0].cart && userProfile[0].cart.map(async (itemId,index)=>{
                const result = await client.db("digi-prex-shopping").collection("items").find({_id : ObjectId(itemId)}).toArray();
                items.push(result[0]);
                if(items.length === userProfile[0].cart.length){
                    sendNotification(items);
                }
            });
        }else{
            return [];
        }
    }

    function sendNotification(data) {
        console.log("entered sendNotification fn()",data);
        if(data.length){
            notificationMailer(emailId,link,data);
        } 
    }

    // setTimeout(()=>getCartDetailsAtMoment(), 1000);   
    
    setTimeout(()=>getCartDetailsAtMoment(), 1800000);

    setTimeout(()=>getCartDetailsAtMoment(), 86400000);

    setTimeout(()=>getCartDetailsAtMoment(), 259200000);
 
});




function notificationMailer(email,link,itemsArray){
    try{
        var transporter = nodemailer.createTransport({
            service: "outlook",
            auth: {
                user: "coderatwork@outlook.com",
                pass: process.env.password
            }
        });
    
        transporter.use("compile",hbs({
            viewEngine: {
                extName: '.handlebars',
                partialsDir: './views/', 
                defaultLayout: false
            },
            viewPath: "./views/",
            extName: '.handlebars'
        }));
    
        var mailOptions = {
            from: "coderatwork@outlook.com",
            to: email,
            subject: "Remainder - Hey, Look in to your cart. Your Items are waiting for you...",
            text: "Hi User",
            template: "index",
            context: {
                image1 : itemsArray[0].poster,
                name1 : itemsArray[0].name,
                image2 : itemsArray[1]?.poster,
                name2 : itemsArray[1]?.name,
                image3 : itemsArray[2]?.poster,
                name3 : itemsArray[2]?.name,
                image4 : itemsArray[3]?.poster,
                name4 : itemsArray[3]?.name,
                link: link
            }
        }
    
        transporter.sendMail(mailOptions,function(error,info){
            if(error){
                console.log(error);
            }else{
                console.log(`Email sent:`+info.response)
            }
        })
    }catch(err){
        console.log(err);
    }
    
}




export const itemRouter = router;