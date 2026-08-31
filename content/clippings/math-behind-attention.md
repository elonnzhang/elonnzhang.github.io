---
title: "Math behind Attention - Q, K, and V"
source: "https://outcomeschool.com/blog/math-behind-attention-qkv"
author:
  - "[[Amit Shekhar]]"
published: 2026-04-03
created: 2026-04-03
description: "In this blog, we will learn about the math behind Attention - Query(Q), Key(K), and Value(V) with a step-by-step numeric example."
tags:
  - "clippings"
---

![Math behind Attention: Q, K, and V](https://outcomeschool.com/_next/image?url=%2Fstatic%2Fimages%2Fblog%2Fmath-behind-attention-qkv.png&w=3840&q=75)

Math behind Attention: Q, K, and V

In this blog, we will learn about the math behind Attention: Query(Q), Key(K), and Value(V) with a step-by-step numeric example.

We will cover the following:

- The Attention Formula
- Setting Up: From Words to Vectors
- Creating Q, K, and V Matrices
- Computing Attention Scores (Q x K^T)
- Scaling the Scores
- Applying Softmax
- Computing the Final Output (Attention Weights x V)
- Putting It All Together

I am **Amit Shekhar**, Founder @ [Outcome School](https://outcomeschool.com/), I have taught and mentored many developers, and their efforts landed them high-paying tech jobs, helped many tech companies in solving their unique problems, and created many open-source libraries being used by top companies. I am passionate about sharing knowledge through open-source, blogs, and videos.

I teach [AI and Machine Learning](https://outcomeschool.com/program/ai-and-machine-learning) at Outcome School.

Let's get started.

## The Attention Formula

The core formula for **Scaled Dot-Product Attention** is:

```
Attention(Q, K, V) = softmax(Q x K^T / sqrt(d_k)) x V
```

Here:

- `Q` is the Query matrix
- `K` is the Key matrix
- `V` is the Value matrix
- `K^T` is the transpose of the Key matrix
- `d_k` is the dimension of the Key vector
- `sqrt` means square root

Do not worry if this formula looks complex. We will break it down step by step with actual numbers. By the end of this blog, every part of this formula will be clear.

The idea is simple: we compare what each word is looking for (**Query**) with what every other word offers (**Key**), and then use those comparisons to collect the actual information (**Value**) from the most relevant words.

Now, let's see this with real numbers.

## Setting Up: From Words to Vectors

Let's take a simple sentence with 3 words:

**"I love AI"**

In a [Transformer](https://outcomeschool.com/blog/decoding-transformer-architecture), each word is first converted into a vector (i.e. a list of numbers) called an [embedding](https://www.youtube.com/watch?v=LedXW6xl21s). Just for the sake of understanding, we will use very small vectors of size 4 (i.e. `d_emb = 4`).

```prolog
"I"    → [1.0, 0.0, 1.0, 0.0]
"love" → [0.0, 1.0, 0.0, 1.0]
"AI"   → [1.0, 1.0, 0.0, 0.0]
```

We stack these into an **input matrix X** of shape `3 x 4` (3 words, each with 4 numbers):

```
X = | 1.0  0.0  1.0  0.0 |   ← "I"
    | 0.0  1.0  0.0  1.0 |   ← "love"
    | 1.0  1.0  0.0  0.0 |   ← "AI"
```

Here, each row is one word and each column is one number in the embedding. This is our starting point.

## Creating Q, K, and V Matrices

Now, we need to create three separate matrices: **Q (Query)**, **K (Key)**, and **V (Value)**.

How do we create them? We multiply the input matrix `X` with three separate **weight matrices**: `W_Q`, `W_K`, and `W_V`. These weight matrices are learned during training.

```
Q = X x W_Q
K = X x W_K
V = X x W_V
```

For our example, let's say `d_k = 3` (i.e. we want Q, K, V vectors of size 3). So each weight matrix has the shape `4 x 3` (input dimension 4, output dimension 3).

Let's use the following weight matrices for the sake of understanding:

```
W_Q = | 1  0  1 |
      | 0  1  0 |
      | 1  0  0 |
      | 0  1  1 |

W_K = | 0  1  0 |
      | 1  0  1 |
      | 0  0  1 |
      | 1  1  0 |

W_V = | 1  0  0 |
      | 0  1  0 |
      | 0  0  1 |
      | 1  1  0 |
```

Now, let's compute Q, K, and V.

**Computing Q = X x W_Q:**

```
Q = | 1.0  0.0  1.0  0.0 |     | 1  0  1 |
    | 0.0  1.0  0.0  1.0 |  x  | 0  1  0 |
    | 1.0  1.0  0.0  0.0 |     | 1  0  0 |
                               | 0  1  1 |
```

For the first row ("I"): `[1*1 + 0*0 + 1*1 + 0*0, 1*0 + 0*1 + 1*0 + 0*1, 1*1 + 0*0 + 1*0 + 0*1]` = `[2, 0, 1]`

For the second row ("love"): `[0*1 + 1*0 + 0*1 + 1*0, 0*0 + 1*1 + 0*0 + 1*1, 0*1 + 1*0 + 0*0 + 1*1]` = `[0, 2, 1]`

For the third row ("AI"): `[1*1 + 1*0 + 0*1 + 0*0, 1*0 + 1*1 + 0*0 + 0*1, 1*1 + 1*0 + 0*0 + 0*1]` = `[1, 1, 1]`

```
Q = | 2  0  1 |   ← "I"
    | 0  2  1 |   ← "love"
    | 1  1  1 |   ← "AI"
```

**Computing K = X x W_K:**

For the first row ("I"): `[1*0 + 0*1 + 1*0 + 0*1, 1*1 + 0*0 + 1*0 + 0*1, 1*0 + 0*1 + 1*1 + 0*0]` = `[0, 1, 1]`

For the second row ("love"): `[0*0 + 1*1 + 0*0 + 1*1, 0*1 + 1*0 + 0*0 + 1*1, 0*0 + 1*1 + 0*1 + 1*0]` = `[2, 1, 1]`

For the third row ("AI"): `[1*0 + 1*1 + 0*0 + 0*1, 1*1 + 1*0 + 0*0 + 0*1, 1*0 + 1*1 + 0*1 + 0*0]` = `[1, 1, 1]`

```
K = | 0  1  1 |   ← "I"
    | 2  1  1 |   ← "love"
    | 1  1  1 |   ← "AI"
```

**Computing V = X x W_V:**

For the first row ("I"): `[1*1 + 0*0 + 1*0 + 0*1, 1*0 + 0*1 + 1*0 + 0*1, 1*0 + 0*0 + 1*1 + 0*0]` = `[1, 0, 1]`

For the second row ("love"): `[0*1 + 1*0 + 0*0 + 1*1, 0*0 + 1*1 + 0*0 + 1*1, 0*0 + 1*0 + 0*1 + 1*0]` = `[1, 2, 0]`

For the third row ("AI"): `[1*1 + 1*0 + 0*0 + 0*1, 1*0 + 1*1 + 0*0 + 0*1, 1*0 + 1*0 + 0*1 + 0*0]` = `[1, 1, 0]`

```
V = | 1  0  1 |   ← "I"
    | 1  2  0 |   ← "love"
    | 1  1  0 |   ← "AI"
```

Now, we have our Q, K, and V matrices ready.

**Note:** In real models, these weight matrices are not set by hand. They are learned during training. We are using simple numbers here for the sake of understanding.

Till now, we have learned how to create Q, K, and V from the input. Now, let's move to the next step.

If we want to go deep into Q/K/V matrices, embeddings, and Transformer internals from the ground up, we have a complete program on it - check out our [AI and Machine Learning Program](https://outcomeschool.com/program/ai-and-machine-learning) at Outcome School.

## Computing Attention Scores (Q x K^T)

The first step in the attention formula is to compute `Q x K^T`.

This tells us how much each word should attend to every other word. We multiply the Query of each word with the Key of every other word.

First, we need `K^T` (transpose of K). Transposing simply means we swap the rows and columns. The first row becomes the first column, the second row becomes the second column, and so on:

```
K^T = | 0  2  1 |
      | 1  1  1 |
      | 1  1  1 |
```

Now, let's compute `Q x K^T`:

```
Q x K^T = | 2  0  1 |     | 0  2  1 |
          | 0  2  1 |  x  | 1  1  1 |
          | 1  1  1 |     | 1  1  1 |
```

For "I" attending to all words:

- "I" → "I": `2*0 + 0*1 + 1*1` = `1`
- "I" → "love": `2*2 + 0*1 + 1*1` = `5`
- "I" → "AI": `2*1 + 0*1 + 1*1` = `3`

For "love" attending to all words:

- "love" → "I": `0*0 + 2*1 + 1*1` = `3`
- "love" → "love": `0*2 + 2*1 + 1*1` = `3`
- "love" → "AI": `0*1 + 2*1 + 1*1` = `3`

For "AI" attending to all words:

- "AI" → "I": `1*0 + 1*1 + 1*1` = `2`
- "AI" → "love": `1*2 + 1*1 + 1*1` = `4`
- "AI" → "AI": `1*1 + 1*1 + 1*1` = `3`

```
"I"   "love"   "AI"
Scores = |  1      5       3  |   ← "I"
         |  3      3       3  |   ← "love"
         |  2      4       3  |   ← "AI"
```

Here, we can see that the word "I" gives the highest attention score of `5` to "love", meaning "I" finds "love" the most relevant. The word "love" gives equal scores of `3` to all words. The word "AI" gives the highest score of `4` to "love".

This was all about computing the attention scores. Now, let's move to scaling.

## Scaling the Scores

Now, we divide every score by `sqrt(d_k)`.

In our example, `d_k = 3` (the dimension of our Key vectors), so `sqrt(3) = 1.732`.

Now, the question is: why do we scale? The answer is: if the dot product values are too large, the softmax function in the next step will produce very extreme values (close to 0 or 1). This makes it difficult for the model to learn. Scaling keeps the values in a manageable range. We have a detailed blog on the [Math behind √dₖ Scaling Factor in Attention](https://outcomeschool.com/blog/scaling-dot-product-attention) that explains this in depth.

```
Scaled Scores = Scores / sqrt(3)
```

```
"I"      "love"     "AI"
Scaled Scores = |  0.577    2.887     1.732  |   ← "I"
                |  1.732    1.732     1.732  |   ← "love"
                |  1.155    2.309     1.732  |   ← "AI"
```

Here, we can notice that the relative order of the scores has not changed. The word "I" still attends to "love" the most. But the values are now smaller, which is exactly what we wanted.

**A quick note for you**

No matter which tech domain you work in, get familiar with these topics:

- LLM
- RAG
- MCP
- Agent
- Fine-tuning
- Quantization

We put it all together in one video:

[AI Engineering Explained: LLM, RAG, MCP, Agent, Fine-Tuning, and Quantization](https://www.youtube.com/watch?v=lnfWvX66FUk)

No need to stop reading - bookmark it and watch later when you get time. Future you will thank you.

Now, let's get back to the topic.

In the future, I plan to write about why we choose to divide by `sqrt(d_k)` instead of some other factor.

Now, let's apply softmax.

## Applying Softmax

Now, we apply the **softmax** function to each row. [Softmax](https://www.youtube.com/watch?v=2Zx6x01WwWM) converts the scores into probabilities that add up to 1.

The softmax formula for a value `x_i` in a row is:

```
softmax(x_i) = e^(x_i) / sum(e^(x_j) for all j in that row)
```

Here, `e` is the mathematical constant (approximately 2.718). Do not worry about the formula too much. We will compute it step by step.

**For the "I" row: \[0.577, 2.887, 1.732\]**

- `e^0.577` = 1.781
- `e^2.887` = 17.940
- `e^1.732` = 5.651
- Sum = 1.781 + 17.940 + 5.651 = 25.372

Attention Weights:

- "I" → "I": 1.781 / 25.372 = **0.070**
- "I" → "love": 17.940 / 25.372 = **0.707**
- "I" → "AI": 5.651 / 25.372 = **0.223**

**For the "love" row: \[1.732, 1.732, 1.732\]**

All values are equal, so each word gets equal attention:

- "love" → "I": **0.333**
- "love" → "love": **0.333**
- "love" → "AI": **0.333**

**For the "AI" row: \[1.155, 2.309, 1.732\]**

- `e^1.155` = 3.174
- `e^2.309` = 10.063
- `e^1.732` = 5.651
- Sum = 3.174 + 10.063 + 5.651 = 18.888

Attention Weights:

- "AI" → "I": 3.174 / 18.888 = **0.168**
- "AI" → "love": 10.063 / 18.888 = **0.533**
- "AI" → "AI": 5.651 / 18.888 = **0.299**

The final **Attention Weight Matrix** is:

```
"I"     "love"    "AI"
Attention Weights = | 0.070    0.707    0.223 |   ← "I"
                    | 0.333    0.333    0.333 |   ← "love"
                    | 0.168    0.533    0.299 |   ← "AI"
```

Here, we can see that:

- The word **"I"** pays 70.7% of its attention to **"love"**, 22.3% to **"AI"**, and only 7.0% to itself.
- The word **"love"** pays equal attention to all three words (33.3% each).
- The word **"AI"** pays 53.3% of its attention to **"love"**, 29.9% to itself, and 16.8% to **"I"**.

Each row adds up to 1.0 (i.e. 100%). This is what softmax ensures.

Now, we have the attention weights. It is time to compute the final output.

## Computing the Final Output (Attention Weights x V)

Now, we multiply the Attention Weight Matrix with the Value matrix `V` to get the final output.

```
Output = Attention Weights x V
```

```
Output = | 0.070  0.707  0.223 |     | 1  0  1 |
         | 0.333  0.333  0.333 |  x  | 1  2  0 |
         | 0.168  0.533  0.299 |     | 1  1  0 |
```

**For "I":**

- `0.070*1 + 0.707*1 + 0.223*1` = `1.000`
- `0.070*0 + 0.707*2 + 0.223*1` = `1.637`
- `0.070*1 + 0.707*0 + 0.223*0` = `0.070`

**For "love":**

- `0.333*1 + 0.333*1 + 0.333*1` = `0.999`
- `0.333*0 + 0.333*2 + 0.333*1` = `0.999`
- `0.333*1 + 0.333*0 + 0.333*0` = `0.333`

**For "AI":**

- `0.168*1 + 0.533*1 + 0.299*1` = `1.000`
- `0.168*0 + 0.533*2 + 0.299*1` = `1.365`
- `0.168*1 + 0.533*0 + 0.299*0` = `0.168`

```
Output = | 1.000  1.637  0.070 |   ← "I"
         | 1.000  1.000  0.333 |   ← "love"
         | 1.000  1.365  0.168 |   ← "AI"
```

Here, we can see that each word now has a new vector that is a **weighted combination** of the Value vectors of all words. The word "I" gets a new representation that is heavily influenced by the Value of "love" (because it had the highest attention weight of 0.707 for "love"). This is the power of the attention mechanism.

The output for each word is no longer just about that word alone. It now contains information from all the other words, weighted by how relevant they are. This is how the model understands context and relationships between words.

This was all about computing the final output. Now, let's put it all together.

To master self-attention, multi-head attention, and the full Transformer math in depth, check out our [AI and Machine Learning Program](https://outcomeschool.com/program/ai-and-machine-learning) at Outcome School.

## Putting It All Together

Let's summarize the entire computation in one place:

**Step 1:** Start with the input embeddings (X).

**Step 2:** Multiply X with weight matrices to get Q, K, and V.

**Step 3:** Compute attention scores by multiplying Q with the transpose of K (Q x K^T).

**Step 4:** Scale the scores by dividing by sqrt(d_k).

**Step 5:** Apply softmax to get attention weights (probabilities).

**Step 6:** Multiply attention weights with V to get the final output.

The entire process in one formula:

```
Attention(Q, K, V) = softmax(Q x K^T / sqrt(d_k)) x V
```

Now, every part of this formula is clear.

This is how the math behind Query, Key, and Value works in the Attention mechanism.

Every Large Language Model uses this exact computation at its core. The numbers we used were small for the sake of understanding, but in real models, the dimensions are much larger (512, 1024, or more) and the weight matrices are learned during training.

In real models, this Q, K, and V computation also runs many times in parallel, once per head. We have a detailed blog on [Multi-Head Attention in Transformers](https://outcomeschool.com/blog/multi-head-attention-in-transformers) that explains how these parallel heads work.

Now, we must have understood the math behind Attention: Q, K, and V.

Prepare yourself for AI Engineering Interview: [AI Engineering Interview Questions](https://github.com/amitshekhariitbhu/ai-engineering-interview-questions)

That's it for now.

Thanks

**Amit Shekhar**
Founder @ [Outcome School](https://outcomeschool.com/)

You can connect with me on:

- [X](https://x.com/amitiitbhu)
- [LinkedIn](https://www.linkedin.com/in/amit-shekhar-iitbhu)
- [GitHub](https://github.com/amitshekhariitbhu)

Follow Outcome School on:

- [X](https://x.com/outcome_school)
- [YouTube](https://youtube.com/@OutcomeSchool)
- [LinkedIn](https://www.linkedin.com/company/outcomeschool)
- [GitHub](https://github.com/OutcomeSchool)

Subscribe to our [newsletter](https://outcomeschool.substack.com/subscribe) to get our latest AI and Machine Learning blogs straight to your inbox.
