import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { OPENAI_API_KEY } from "$env/static/private";
import OpenAI from "openai";
const openai = new OpenAI( {apiKey : OPENAI_API_KEY } );

export const POST: RequestHandler = async({request}) => {
    const { text } = await request.json()
    
    const moderation = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: text,
    });

    return json({
        result : moderation.results[0].flagged
    })
}