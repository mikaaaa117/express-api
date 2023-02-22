import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 7564;

app.use(express.json());
app.use(cors());

app.get("/posts", async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: {
        published: true,
      },
      include: {
        author: true,
      },
    });

    res.status(200).json(posts);
  } catch (error) {
    console.log(error);
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({
      where: {
        id,
      },
      include: {
        comments: true,
        likedBy: true,
      },
    });

    res.status(200).json(post);
  } catch (error) {
    console.log(error);
  }
});

app.put("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, image, authorId } = req.body;
    const post = await prisma.post.findUnique({
      where: {
        id,
      },
    });

    if (!post) throw new Error("NOT_FOUND");

    console.log(post.authorId);
    console.log(authorId);
    if (post?.authorId !== authorId) {
      throw new Error("BAD_REQUEST");
    }

    const updatedPost = await prisma.post.update({
      where: {
        id: post.id,
      },
      data: {
        title,
        content,
        image,
      },
    });

    res.status(200).json(updatedPost);
  } catch (error) {
    console.log(error);
  }
});

app.post("/posts/create", async (req, res) => {
  try {
    const { title, content, authorId, image } = req.body;
    console.log(authorId);
    const post = await prisma.post.create({
      data: {
        title,
        content,
        image,
        author: { connect: { id: authorId } },
      },
    });

    res.status(200).json(post);
  } catch (error) {
    console.log(error);
  }
});

app.put("/posts/publish/:id", async (req, res) => {
  try {
    console.log("start publish");
    const { id } = req.params;
    console.log("@Id", id);
    const post = await prisma.post.update({
      where: {
        id,
      },
      data: {
        published: true,
      },
    });
    console.log("@Published", post);

    res.status(200).json(post);
  } catch (error) {
    console.log(error);
  }
});

app.post("/posts/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.delete({
      where: { id },
    });

    res.status(200).json(post);
  } catch (error) {
    console.log(error);
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    console.log(req.body);
    const { email, password } = req.body;
    console.log("Credentials", email, password);
    if (!email || !password) throw new Error("BAD_REQUEST");

    const candidate = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!candidate) throw new Error("User doesn't exists");

    const auth = await bcrypt.compare(password, candidate.password);

    if (!auth) throw new Error("UNAUTHORIZED");

    const token = jwt.sign(
      { id: candidate.id },
      process.env.SECRET_KEY ?? "SUPER_SECRET_KEY",
      {
        expiresIn: "12h",
      }
    );

    res.status(200).json({ token });
  } catch (error) {
    console.log(error);
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    console.log(req.body);
    const { email, password, name } = req.body;
    console.log("Credentials", email, name, password);
    if (!email || !password || !name) throw new Error("BAD_REQUEST");

    const candidate = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (candidate) throw new Error("User already exists");

    const hashedPassword = await bcrypt.hash(password, 5);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    const token = jwt.sign(
      { id: user.id },
      process.env.SECRET_KEY ?? "SUPER_SECRET_KEY",
      { expiresIn: "12h" }
    );

    res.status(200).json({ token });
  } catch (error) {
    console.log(error);
  }
});

app.get("/auth/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      throw new Error("UNAUTHORIZED");
    }

    const decoded = jwt.verify(
      token,
      process.env.SECRET_KEY ?? "SUPER_SECRET_KEY"
    ) as { id: string };
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      include: {
        likedPosts: true,
        posts: true,
      },
    });

    if (!user) throw new Error("User not found");

    const newToken = jwt.sign(
      { id: user.id },
      process.env.SECRET_KEY ?? "SUPER_SECRET_KEY",
      { expiresIn: "12h" }
    );
    const userData = { ...user, password: undefined };
    res.status(200).json({ newToken, userData });
  } catch (error) {
    console.log(error);
  }
});

app.listen(PORT, () =>
  console.log(`The app started on http://localhost:${PORT}`)
);
