import { ObjectId } from "bson";
import express from "express";
import Stripe from "stripe";
import { client } from "../index.js";
import cron from "node-cron";
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
    // console.log(cartItemsArray, userId);

    const replaceCart = await client.db("digi-prex-shopping").collection("users").updateOne({_id : ObjectId(userId)},{$set:{cart : cartItemsArray}});
    res.send(replaceCart);
});


//get cart items for booking page

router.get("/getCart/:userId", async (req,res)=>{
    let userId = req.params.userId;
    const userProfile = await client.db("digi-prex-shopping").collection("users").find({_id : ObjectId(userId)}).toArray();
    // console.log("userProfile", userProfile);
    let cartItems = [];
    if(userProfile[0].cart.length === 0){
        res.send([]);
    }else{
        userProfile[0].cart && userProfile[0].cart.map(async (itemId,index)=>{
            const result = await client.db("digi-prex-shopping").collection("items").find({_id : ObjectId(itemId)}).toArray();
            // console.log("...result",result);
            cartItems.push(result[0]);
            // console.log("+++++++++", userProfile[0].cart, index, userProfile[0].cart.length-1, index === userProfile[0].cart.length-1);
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
    // console.log("bookedData",bookedData);
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

    // console.log("paymentIntentOutside......",paymentIntent);

    if(paymentIntent){
        // console.log("paymentIntent", paymentIntent);
        req.body.transactionId = paymentIntent.id;
        // console.log(req.body);
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


//send Notification during signOff

router.get("/sendNotification/:emailId", async (req,res)=>{

    // console.log("I have entered", req.body);

    const {emailId} = req.params;
    const link = `${process.env.frontEndUrl}/bookOrder/fromLink`;
    


    async function getCartDetailsAtMoment(){
        let items=[];
        await client.db("digi-prex-shopping").collection("users").find({email : emailId}).toArray().then((userProfile)=>{
            if(userProfile[0].cart?.length > 0){
                userProfile[0].cart && userProfile[0].cart.map(async (itemId,index)=>{
                    // console.log("itemId......",itemId);
                    const result = await client.db("digi-prex-shopping").collection("items").find({_id : ObjectId(itemId)}).toArray();
                    // console.log("result.....",result);
                    items.push(result[0]);
                    if(items.length === userProfile[0].cart.length){
                        // console.log("items inside......................",items)
                        return items;
                    }
                });
            }else{
                return [];
            }
        })
        // console.log("userProfile.......",userProfile)
        
    }


    var task1 = cron.schedule('*/30 * * * *', async () => {

        let data = await getCartDetailsAtMoment();

            // console.log("hi,task-1",data);
            if(data.length){
                // console.log(data);
                notificationMailer(emailId,link,data);
            }  
    },{
        scheduled: false
    });
        
    setTimeout(()=>task1.start(), 1800000);

    setTimeout(()=>task1.stop(), 2700000);


        
    var task2 = cron.schedule('* */23 * * *', async () => {

        let cartItems = await getCartDetailsAtMoment();

        // console.log("hi,task-02",cartItems);
        if(cartItems.length){
            // console.log(cartItems);
            notificationMailer(emailId,link,cartItems);
        } 
    },{
        scheduled: false
    });

    setTimeout(()=>task2.start(), 86400000);

    setTimeout(()=>task2.stop(), 90000000);

    

    var task3 = cron.schedule('* */23 * * *', async () => {

        let cartItems = await getCartDetailsAtMoment();

        // console.log("hi, task3",cartItems);
        if(cartItems.length){
            // console.log(cartItems);
            notificationMailer(emailId,link,cartItems);
        } 
    },{
        scheduled: false
    });

    setTimeout(()=>task3.start(), 259200000);

    setTimeout(()=>task3.stop(), 262800000);
 
});




function notificationMailer(email,link,itemsArray){
    // console.log("I am inside tooo....");
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
            // html: `<div><h4>Hi User,</h4></br><p>please click the link below for password reset</p></br><a href=${link}/></br></div>`
            // html: `please click the link to reset your password - ${link}`
            template: "index",
            context: {
                image1 : itemsArray[0].poster,
                name1 : itemsArray[0].name,
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