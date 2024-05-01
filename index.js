const express = require("express");
const dotenv = require("dotenv");
const jwtToken = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cors = require("cors");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "taskManager.db");
const app = express();

dotenv.config({
  path: "./data/config.env",
});

app.use(cors());

app.use(express.json());

const secretKey = "saikiran@1234";
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(process.env.PORT, () =>
      console.log(`server is running on port ${process.env.PORT}`)
    );
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Middelware
const verifyUserIdentity = (req, resp, next) => {
  const authHeader = req.headers["authorization"];

  let jwt;
  if (authHeader !== undefined) {
    jwt = authHeader.split(" ")[1];
  }

  if (jwt === undefined) {
    resp.send({ error: "Invaild Access Token" }).status(400);
  } else {
    jwtToken.verify(jwt, secretKey, (error, playload) => {
      if (error) {
        resp.send({ error: "Invaild Access Token" }).status(400);
      } else {
        next();
      }
    });
  }
};

app.post("/register", async (req, resp) => {
  const { username, password, role = "user" } = req.body;
  const searchUser = `select * from users where username = '${username}'`;
  const data = await db.get(searchUser);
  if (data === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const storeDataQuery = `insert into users(username , password_hash , role) values('${username}', '${hashedPassword}' , '${role}')`;
    const response = await db.run(storeDataQuery);
    const token = jwtToken.sign({ username }, secretKey);
    resp.send({ userId: response.lastID, role, jwtToken: token }).status(200);
  } else {
    resp.send({ error: "This username is already registered" }).status(400);
  }
});

app.post("/login", async (req, resp) => {
  const { username, password } = req.body;
  const checkuser = `select * from users where username='${username}'`;
  const response = await db.get(checkuser);
  if (response !== undefined) {
    const comperPassword = await bcrypt.compare(
      password,
      response.password_hash
    );
    if (comperPassword) {
      const token = jwtToken.sign({ username }, secretKey);
      resp
        .send({ userId: response.id, role: response.role, jwtToken: token })
        .status(200);
    } else {
      resp.send({ error: "password is wrong" }).status(400);
    }
  } else {
    resp.send({ error: "This username is not registered" }).status(400);
  }
});

// for users and admin
app.post("/addtask", verifyUserIdentity, async (req, resp) => {
  const { title, description, status, assigneeId, createdAt, updatedAt } =
    req.body;
  try {
    const queryOfAddTask = `insert into tasks(title , description ,status , assignee_id , created_at , updated_at) values('${title}' , '${description}' ,${status} , ${assigneeId} , '${createdAt}' , '${updatedAt}')`;
    const response = await db.run(queryOfAddTask);
    resp.send({ taskId: response.lastID }).status(200);
  } catch (e) {
    console.log(e);
  }
});

// for users
app.get("/getData", verifyUserIdentity, async (req, resp) => {
  const { user_id } = req.query;
  const createQuery = `select *from tasks where assignee_id = ${user_id} order by updated_at desc`;
  const response = await db.all(createQuery);
  resp.send(response);
});

// for admin
app.get("/getAllData", verifyUserIdentity, async (req, resp) => {
  const createQuery = `select tasks.id as taskId , username , title,  description , status , assignee_id , created_at , updated_at from users inner join tasks on users.id = tasks.assignee_id order by updated_at desc`;
  const response = await db.all(createQuery);
  resp.send(response);
});

//for users and admin
app.put("/updateData", verifyUserIdentity, async (req, resp) => {
  const {
    title,
    description,
    status,
    assigneeId,
    createdAt,
    updatedAt,
    taskId,
  } = req.body;
  const createQuery = `update tasks set title = '${title}' , description = '${description}' , 
  status = ${status} , assignee_id = ${assigneeId}, created_at='${createdAt}' , updated_at ='${updatedAt}' where id = ${taskId}`;
  await db.run(createQuery);
  resp.send({ msg: "task updated successfuly" }).status(200);
});

// users and admin
app.delete("/deleteTask", verifyUserIdentity, async (req, resp) => {
  const { taskId } = req.body;
  const createQuery = `delete from tasks where id=${taskId}`;
  await db.run(createQuery);
  resp.send({ msg: "task deleted successfuly" }).status(200);
});
