import type {ErrorRequestHandler,Response} from 'express';
import {ZodError} from 'zod';
import multer from 'multer';
export class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
export const ok=(res:Response,data:unknown,status=200)=>res.status(status).json({success:true,data});
export const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
 let status=500,code='INTERNAL_ERROR',message='The request could not be completed. Please try again.';
 if(error instanceof ApiError){({status,code,message}=error);}
 else if(error instanceof ZodError){status=400;code='VALIDATION_ERROR';message=error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');}
 else if(error instanceof multer.MulterError){status=400;code='INVALID_UPLOAD';message=error.code==='LIMIT_FILE_SIZE'?'Images must be 10 MB or smaller.':'Choose one JPEG, PNG or WebP image per upload.';}
 else if(error.code==='23505'){status=409;code='DUPLICATE';message='This name or event/house/category result already exists.';}
 else if(error.code==='23503'){status=409;code='RELATED_RECORD';message='A referenced record is missing or this record is still in use.';}
 else if(error.code==='23514'||error.code==='22007'||error.code==='22008'){status=400;code='VALIDATION_ERROR';message='One or more values are invalid.';}
 else if(error.type==='entity.too.large'){status=413;code='REQUEST_TOO_LARGE';message='Request is too large.';}
 else if(error.type==='entity.parse.failed'){status=400;code='INVALID_JSON';message='Request must contain valid JSON.';}
 if(status===500)console.error('API error',{code:error.code,name:error.name,message:error.message});
 if(!res.headersSent)res.status(status).json({success:false,error:{code,message}});
};
