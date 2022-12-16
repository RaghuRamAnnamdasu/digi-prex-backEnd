import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import { initialData } from "./initialData.js";
import { userRouter } from "./Routers/users.js";
import { itemRouter } from "./Routers/items.js";


const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4000;

const mongo_URL = process.env.Mongo_URL;

async function createConnection(){
    const client = new MongoClient(mongo_URL);
    await client.connect();
    console.log("MongoDB is connected");
    return client;
}

export const client = await createConnection();


app.get("/", (req,res)=>{
    res.send("Welcome to Digi Prex shopping cart task")
})

app.use("/users",userRouter);
app.use("/items",itemRouter);
 
// await client.db("digi-prex-shopping").collection("items").insertMany(initialData);   
// Dont uncomment this.

app.listen(port,()=>console.log(`App is started in port ${port}`));