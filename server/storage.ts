import { db } from "./db";
import {
  coaches,
  reviews,
  users,
  contactSubmissions,
  type InsertCoach,
  type InsertReview,
  type InsertUser,
  type InsertContact,
  type Coach,
  type Review,
  type User,
  type ContactSubmission
} from "@shared/schema";
import { eq, ilike, sql } from "drizzle-orm";

export interface PendingReview {
  id: number;
  coachName: string;
  coachInstagram: string | null;
  coachEmail: string | null;
  coachPhone: string | null;
  coachWhatsapp: string | null;
  ratingResponseTime: number | null;
  ratingKnowledge: number | null;
  ratingResults: number | null;
  ratingCommunication: number | null;
  communicationStyle: string | null;
  comment: string;
  authorName: string;
  proofUrl: string | null;
  status: string | null;
  createdAt: Date | null;
}

export interface CoachWithRating {
  id: number;
  name: string;
  sport: string;
  instagram: string | null;
  imageUrl: string | null;
  calculatedRating: string;
  feedbackCount: number;
}

export interface IStorage {
  getCoaches(search?: string): Promise<Coach[]>;
  getCoach(id: number): Promise<Coach | undefined>;
  getCoachByName(name: string): Promise<Coach | undefined>;
  getCoachesWithRatings(search?: string): Promise<CoachWithRating[]>;
  createReview(review: InsertReview): Promise<Review>;
  createCoach(coach: InsertCoach): Promise<Coach>;
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  getPendingReviews(): Promise<PendingReview[]>;
  getApprovedReviewsByCoachName(coachName: string): Promise<Review[]>;
  updateReviewStatus(id: number, status: string): Promise<Review | undefined>;
  getReview(id: number): Promise<Review | undefined>;
  createContactSubmission(contact: InsertContact): Promise<ContactSubmission>;
  updateUserRole(id: number, role: string): Promise<void>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  getAthleteCount(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getCoaches(search?: string): Promise<Coach[]> {
    if (search) {
      return await db.select().from(coaches).where(ilike(coaches.name, `%${search}%`));
    }
    return await db.select().from(coaches);
  }

  async getCoach(id: number): Promise<Coach | undefined> {
    const [coach] = await db.select().from(coaches).where(eq(coaches.id, id));
    return coach;
  }

  async getCoachByName(name: string): Promise<Coach | undefined> {
    const trimmedName = name.trim();
    const [coach] = await db.select().from(coaches).where(ilike(coaches.name, trimmedName));
    return coach;
  }

  async getCoachesWithRatings(search?: string): Promise<CoachWithRating[]> {
    // Get all coaches
    let coachList: Coach[];
    if (search) {
      coachList = await db.select().from(coaches).where(ilike(coaches.name, `%${search}%`));
    } else {
      coachList = await db.select().from(coaches);
    }

    // Get all approved reviews
    const approvedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.status, "approved"));

    // Calculate ratings for each coach
    return coachList.map((coach) => {
      const coachReviews = approvedReviews.filter(
        (r) => r.coachName && coach.name && r.coachName.toLowerCase() === coach.name.toLowerCase()
      );

      if (coachReviews.length === 0) {
        return {
          id: coach.id,
          name: coach.name,
          sport: coach.sport,
          instagram: coach.instagram,
          imageUrl: coach.imageUrl,
          calculatedRating: "0.0",
          feedbackCount: 0,
        };
      }

      // Calculate: Sum of all ratings / (feedbacks × 4)
      let totalSum = 0;
      coachReviews.forEach((review) => {
        if (review.ratingResponseTime !== null) totalSum += review.ratingResponseTime;
        if (review.ratingKnowledge !== null) totalSum += review.ratingKnowledge;
        if (review.ratingResults !== null) totalSum += review.ratingResults;
        if (review.ratingCommunication !== null) totalSum += review.ratingCommunication;
        if (review.ratingAvailability !== null) totalSum += review.ratingAvailability;
      });

      const overallRating = totalSum / (coachReviews.length * 5);

      return {
        id: coach.id,
        name: coach.name,
        sport: coach.sport,
        instagram: coach.instagram,
        imageUrl: coach.imageUrl,
        calculatedRating: overallRating.toFixed(1),
        feedbackCount: coachReviews.length,
      };
    });
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(insertReview).returning();
    return review;
  }

  async createCoach(insertCoach: InsertCoach): Promise<Coach> {
    const [coach] = await db.insert(coaches).values(insertCoach).returning();
    return coach;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getPendingReviews(): Promise<PendingReview[]> {
    const result = await db
      .select({
        id: reviews.id,
        coachName: reviews.coachName,
        coachInstagram: reviews.coachInstagram,
        coachEmail: reviews.coachEmail,
        coachPhone: reviews.coachPhone,
        coachWhatsapp: reviews.coachWhatsapp,
        ratingResponseTime: reviews.ratingResponseTime,
        ratingKnowledge: reviews.ratingKnowledge,
        ratingResults: reviews.ratingResults,
        ratingCommunication: reviews.ratingCommunication,
        communicationStyle: reviews.communicationStyle,
        comment: reviews.comment,
        authorName: reviews.authorName,
        proofUrl: reviews.proofUrl,
        status: reviews.status,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.status, 'pending'));
    return result;
  }

  async getApprovedReviewsByCoachName(coachName: string): Promise<Review[]> {
    const result = await db
      .select()
      .from(reviews)
      .where(eq(reviews.status, 'approved'));
    return result.filter(r => 
      r.coachName?.toLowerCase().includes(coachName.toLowerCase())
    );
  }

  async updateReviewStatus(id: number, status: string): Promise<Review | undefined> {
    const [review] = await db
      .update(reviews)
      .set({ status })
      .where(eq(reviews.id, id))
      .returning();
    return review;
  }

  async getReview(id: number): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review;
  }

  async createContactSubmission(contact: InsertContact): Promise<ContactSubmission> {
    const [submission] = await db.insert(contactSubmissions).values(contact).returning();
    return submission;
  }

  async updateUserRole(id: number, role: string): Promise<void> {
    await db.update(users).set({ role }).where(eq(users.id, id));
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    await db.update(users).set(updates).where(eq(users.id, id));
    return await this.getUser(id);
  }

  async getAthleteCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isAthlete, true));
    return Number(result[0]?.count ?? 0);
  }
}

export const storage = new DatabaseStorage();
