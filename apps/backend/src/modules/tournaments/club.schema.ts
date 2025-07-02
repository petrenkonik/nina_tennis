import { Schema, Document } from 'mongoose';

export interface ClubDocument extends Document {
  name: string;
}

export const ClubSchema = new Schema<ClubDocument>({
  name: { type: String, required: true, unique: true },
}); 