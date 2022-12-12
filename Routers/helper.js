import { client } from "../index.js";

export async function getUserByName(email) {
    return await client.db("digi-prex-shopping").collection("users").findOne({email : email});
  }

export async function createUSer(data) {
return await client.db("digi-prex-shopping").collection("users").insertOne(data);
}