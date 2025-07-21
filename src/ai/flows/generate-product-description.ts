'use server';

/**
 * @fileOverview AI-powered product description generator.
 *
 * - generateProductDescription - A function that generates marketing copy snippets for product descriptions.
 * - GenerateProductDescriptionInput - The input type for the generateProductDescription function.
 * - GenerateProductDescriptionOutput - The return type for the generateProductDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateProductDescriptionInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  productDescription: z.string().describe('The current description of the product.'),
  targetAudience: z.string().describe('The target audience for the product.'),
  keywords: z.string().describe('Keywords related to the product.'),
});
export type GenerateProductDescriptionInput = z.infer<typeof GenerateProductDescriptionInputSchema>;

const GenerateProductDescriptionOutputSchema = z.object({
  marketingCopy: z.string().describe('A marketing copy snippet for the product description.'),
});
export type GenerateProductDescriptionOutput = z.infer<typeof GenerateProductDescriptionOutputSchema>;

export async function generateProductDescription(input: GenerateProductDescriptionInput): Promise<GenerateProductDescriptionOutput> {
  return generateProductDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateProductDescriptionPrompt',
  input: {schema: GenerateProductDescriptionInputSchema},
  output: {schema: GenerateProductDescriptionOutputSchema},
  prompt: `You are a marketing expert specializing in writing compelling product descriptions.

  Given the following product information, generate a short marketing copy snippet to enhance the product description. Focus on appealing to the target audience and incorporating the provided keywords.

  Product Name: {{{productName}}}
  Current Description: {{{productDescription}}}
  Target Audience: {{{targetAudience}}}
  Keywords: {{{keywords}}}

  Marketing Copy Snippet:`, // Ensure the output is concise and engaging.
});

const generateProductDescriptionFlow = ai.defineFlow(
  {
    name: 'generateProductDescriptionFlow',
    inputSchema: GenerateProductDescriptionInputSchema,
    outputSchema: GenerateProductDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
