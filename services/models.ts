import { z } from 'zod';
const imageUrl = z.string().url().refine(v => /^https?:\/\//i.test(v), 'Use an HTTP image URL');
export const HouseSchema = z.object({id:z.string(),name:z.string(),color:z.string().regex(/^#[0-9a-f]{6}$/i),logoUrl:imageUrl.nullish(),points:z.number().finite(),enabled:z.boolean()});
export const EventSchema = z.object({id:z.string(),name:z.string(),category:z.string(),date:z.string().datetime({offset:true}),description:z.string(),status:z.enum(['upcoming','live','completed']),imageUrl:imageUrl.nullish(),venue:z.string().optional(),resultCount:z.number().int().nonnegative().optional()});
export const ResultSchema = z.object({id:z.string(),eventId:z.string(),eventName:z.string(),category:z.string(),houseId:z.string(),position:z.number().int().min(1),points:z.number().finite(),date:z.string().datetime({offset:true}),updatedAt:z.string().datetime({offset:true}).optional()});
export const GallerySchema = z.object({id:z.string(),url:imageUrl,thumbnailUrl:imageUrl.optional(),caption:z.string(),category:z.string(),eventId:z.string().nullable(),eventName:z.string().optional(),createdAt:z.string().datetime({offset:true}),width:z.number().positive().optional(),height:z.number().positive().optional()});
export const BreakdownSchema=z.object({houseId:z.string(),category:z.string(),points:z.number().finite()});
export const StatsSchema=z.object({totalPoints:z.number().finite(),events:z.number().int().nonnegative(),images:z.number().int().nonnegative(),results:z.number().int().nonnegative()});
export const SettingsSchema=z.object({schoolName:z.string(),festivalName:z.string(),description:z.string(),startDate:z.string().nullable(),endDate:z.string().nullable()});
export const SessionSchema=z.object({user:z.object({id:z.string(),name:z.string(),email:z.string().email(),role:z.literal('admin')}).nullable()});
export const pageSchema=<T extends z.ZodTypeAny>(item:T)=>z.object({items:z.array(item),nextCursor:z.string().nullable(),total:z.number().int().nonnegative()});
export type House=z.infer<typeof HouseSchema>;export type FestivalEvent=z.infer<typeof EventSchema>;export type Result=z.infer<typeof ResultSchema>;export type GalleryImage=z.infer<typeof GallerySchema>;export type Breakdown=z.infer<typeof BreakdownSchema>;export type Settings=z.infer<typeof SettingsSchema>;export type Session=z.infer<typeof SessionSchema>;
export type Page<T>={items:T[];nextCursor:string|null;total:number};
export type Query=Record<string,string|number|undefined>;

