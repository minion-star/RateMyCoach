import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import bcrypt from "bcrypt";
import { upload, localStorageService } from "./local-storage";
import { insertContactSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // File upload endpoint for presigned URL flow replacement
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType, subdir = "avatars" } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      if (size && size > 10 * 1024 * 1024) {
        return res.status(400).json({
          error: "File size exceeds maximum (10MB)",
        });
      }

      if (typeof subdir !== "string" || !subdir.match(/^[a-zA-Z0-9_-]+$/)) {
        return res.status(400).json({
          error: "Invalid upload subdirectory",
        });
      }

      // Generate a unique filename and return the presigned URL
      const filename = localStorageService.generateFilename(name);
      const uploadPath = `/uploads/${subdir}/${filename}`;
      const uploadURL = `/api/uploads/${subdir}/${filename}`;
      
      res.json({
        uploadURL,
        objectPath: uploadPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error preparing upload:", error);
      res.status(500).json({ error: "Failed to prepare upload" });
    }
  });

  // File upload endpoint - binary PUT for presigned URL flow
  app.put("/api/uploads/:subdir/:filename", async (req, res) => {
    try {
      const { subdir, filename } = req.params;

      // Validate subdir to prevent directory traversal
      if (!subdir.match(/^[a-zA-Z0-9_-]+$/)) {
        return res.status(400).json({ error: "Invalid subdirectory" });
      }

      // Validate filename
      if (!filename || filename.includes("/") || filename.includes("\\")) {
        return res.status(400).json({ error: "Invalid filename" });
      }

      const relativePath = await localStorageService.saveStream(
        req,
        filename,
        subdir
      );
      const fileUrl = localStorageService.getFileUrl(relativePath);

      res.json({
        success: true,
        fileUrl,
        filePath: relativePath,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // File upload endpoint - multipart form data POST
  app.post("/api/uploads", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const subdir = (req.body.subdir as string) || "files";
      const relativePath = await localStorageService.saveFile(req.file, subdir);
      const fileUrl = localStorageService.getFileUrl(relativePath);

      res.json({
        success: true,
        fileUrl,
        filePath: relativePath,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // File serving endpoint - handle both /uploads/filename and /uploads/subdir/filename
  app.get("/uploads/:subdir/:filename", async (req, res) => {
    try {
      const filePath = `${req.params.subdir}/${req.params.filename}`;
      await localStorageService.serveFile(filePath, res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Fallback for /uploads/filename (single-level paths)
  app.get("/uploads/:filename", async (req, res) => {
    try {
      const filePath = `avatars/${req.params.filename}`;
      await localStorageService.serveFile(filePath, res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  
  app.get("/api/stats", async (req, res) => {
    try {
      const coaches = await storage.getCoaches();
      const coachCount = coaches.length;
      const athletes = await storage.getAthleteCount();
      res.json({ coachCount, athleteCount: athletes });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get(api.coaches.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const coaches = await storage.getCoaches(search);
    res.json(coaches);
  });

  // Get coaches with calculated ratings from approved reviews
  app.get("/api/coaches-with-ratings", async (req, res) => {
    const search = req.query.search as string | undefined;
    const coachesWithRatings = await storage.getCoachesWithRatings(search);
    res.json(coachesWithRatings);
  });

  app.get(api.coaches.get.path, async (req, res) => {
    const coach = await storage.getCoach(Number(req.params.id));
    if (!coach) {
      return res.status(404).json({ message: 'Coach not found' });
    }
    res.json(coach);
  });

  app.post(api.reviews.create.path, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({
          message: "You must be logged in to submit a review",
        });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({
          message: "User not found",
        });
      }

      if (!user.isAthlete) {
        return res.status(403).json({
          message: "Only athletes can submit reviews",
        });
      }

      const input = api.reviews.create.input.parse(req.body);
      
      const reviewData = {
        coachName: input.coachName,
        coachInstagram: input.coachInstagram || null,
        coachEmail: input.coachEmail || null,
        coachPhone: input.coachPhone || null,
        coachWhatsapp: input.coachWhatsapp || null,
        coachingPlatform: input.coachingPlatform || null,
        ratingResponseTime: input.ratingResponseTime || null,
        ratingKnowledge: input.ratingKnowledge || null,
        ratingResults: input.ratingResults || null,
        ratingCommunication: input.ratingCommunication || null,
        ratingAvailability: input.ratingAvailability || null,
        communicationStyle: input.communicationStyle || null,
        comment: input.comment,
        proofUrl: input.proofUrl || null,
        authorName: user.name,
        userId: user.id,
        status: 'pending',
      };
      
      const review = await storage.createReview(reviewData);
      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get("/api/coaches/:id/contact", async (req, res) => {
    const coach = await storage.getCoach(Number(req.params.id));
    if (!coach) {
      return res.status(404).json({ message: "Coach not found" });
    }

    let coachSignupEmail: string | null = null;
    if (coach.userId) {
      const coachUser = await storage.getUser(coach.userId);
      if (coachUser) {
        coachSignupEmail = coachUser.email;
      }
    }

    const approvedReviews = await storage.getApprovedReviewsByCoachName(coach.name);

    const reviewEmails: string[] = [];
    const reviewPhones: string[] = [];
    const reviewWhatsapps: string[] = [];

    for (const review of approvedReviews) {
      if (review.coachEmail && review.coachEmail !== coachSignupEmail && !reviewEmails.includes(review.coachEmail)) {
        reviewEmails.push(review.coachEmail);
      }
      if (review.coachPhone && !reviewPhones.includes(review.coachPhone)) {
        reviewPhones.push(review.coachPhone);
      }
      if (review.coachWhatsapp && !reviewWhatsapps.includes(review.coachWhatsapp)) {
        reviewWhatsapps.push(review.coachWhatsapp);
      }
    }

    res.json({
      signupEmail: coachSignupEmail,
      reviewEmails,
      reviewPhones,
      reviewWhatsapps,
      instagram: coach.instagram,
    });
  });

  app.get(api.reviews.getByCoachName.path, async (req, res) => {
    const coachName = decodeURIComponent(String(req.params.coachName));
    const approvedReviews = await storage.getApprovedReviewsByCoachName(coachName);
    res.json(approvedReviews.map(r => ({
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
    })));
  });

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      if (input.verificationAnswer.trim().toLowerCase() !== "derek lunsford") {
        return res.status(400).json({
          message: "Incorrect verification answer",
          field: "verificationAnswer",
        });
      }
      
      const normalizedEmail = input.email.trim().toLowerCase();
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({
          message: "Email already registered",
          field: "email",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, 10);
      
      let validatedProfilePicture: string | null = null;
      if (input.profilePicture && input.profilePicture.startsWith('/uploads/')) {
        validatedProfilePicture = input.profilePicture;
      }
      
      const user = await storage.createUser({
        name: input.name,
        email: normalizedEmail,
        password: hashedPassword,
        instagram: input.instagram || null,
        profilePicture: validatedProfilePicture,
        isAthlete: input.isAthlete,
        isCoach: input.isCoach,
      });

      if (user.isCoach) {
        await storage.createCoach({
          userId: user.id,
          name: user.name,
          sport: "General",
          description: input.description || null,
          specialties: input.specialties || null,
          instagram: user.instagram,
          imageUrl: validatedProfilePicture,
        });
      }

      req.session.userId = user.id;

      
      res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        isAthlete: user.isAthlete ?? false,
        isCoach: user.isCoach ?? false,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      
      const user = await storage.getUserByEmail(input.email.trim().toLowerCase());
      if (!user) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);
      if (!validPassword) {
        return res.status(401).json({
          message: "Invalid email or password",
        });
      }

      req.session.userId = user.id;
      

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        isAthlete: user.isAthlete ?? false,
        isCoach: user.isCoach ?? false,
        profilePicture: user.profilePicture,
        role: user.role ?? 'user',
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAthlete: user.isAthlete ?? false,
      isCoach: user.isCoach ?? false,
      profilePicture: user.profilePicture,
      role: user.role ?? 'user',
    });
  });

  // Admin routes
  app.get(api.admin.pendingReviews.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    const pendingReviews = await storage.getPendingReviews();
    res.json(pendingReviews.map(r => ({
      ...r,
      createdAt: r.createdAt?.toISOString() ?? null,
    })));
  });

  app.post(api.admin.approveReview.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    const reviewId = Number(req.params.id);
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Check if coach exists, create if not
    const existingCoach = await storage.getCoachByName(review.coachName.trim());
    let coachCreated = false;
    
    if (!existingCoach) {
      // Create a new coach from review data
      await storage.createCoach({
        name: review.coachName.trim(),
        sport: review.coachingPlatform || "General",
        instagram: review.coachInstagram || null,
        phone: review.coachPhone || null,
        imageUrl: null,
        rating: 0,
        reviewCount: 0,
      });
      coachCreated = true;
    }

    await storage.updateReviewStatus(reviewId, 'approved');
    res.json({ success: true, coachCreated });
  });

  app.post(api.admin.rejectReview.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }

    const reviewId = Number(req.params.id);
    const review = await storage.getReview(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    await storage.updateReviewStatus(reviewId, 'rejected');
    res.json({ success: true });
  });

  // Contact form submission
  app.post("/api/contact", async (req, res) => {
    try {
      const contactFormSchema = insertContactSchema.extend({
        firstName: z.string().min(1, "First name is required"),
        email: z.string().email("Valid email is required"),
        message: z.string().min(10, "Message must be at least 10 characters"),
        attachmentUrl: z.string().nullable().optional().refine(
          (val) => !val || val.startsWith("/uploads/"),
          "Invalid attachment URL - must be an uploaded file"
        ),
      });

      const validatedData = contactFormSchema.parse(req.body);

      const submission = await storage.createContactSubmission({
        firstName: validatedData.firstName,
        email: validatedData.email,
        phone: validatedData.phone || null,
        message: validatedData.message,
        attachmentUrl: validatedData.attachmentUrl || null,
      });

      res.json({ success: true, id: submission.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Contact submission error:", error);
      res.status(500).json({ message: "Failed to submit contact form" });
    }
  });

  // Seed initial data if empty
  const existing = await storage.getCoaches();
  if (existing.length === 0) {
    await storage.createCoach({ name: "John Smith", sport: "Football", imageUrl: null });
    await storage.createCoach({ name: "Sarah Connor", sport: "Fitness", imageUrl: null });
    await storage.createCoach({ name: "Mike Tyson", sport: "Boxing", imageUrl: null });
  }

  return httpServer;
}
