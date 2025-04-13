[Slides](https://docs.google.com/presentation/d/1FqsUKDC_I9WGmk3FYcngcpW-bZZqL0hpEo-0RNdobKA/edit#slide=id.p)

![couple-bg](https://github.com/user-attachments/assets/112a45c0-6429-4621-9946-5374c13eb0d2)

## CoupleVest: Help Couples Agree on Investment

### Problem:

- Virtually ALL couples have to manage joint finances

- Every couple we interviewed have different investment preferences
  (eg “single stock” vs “broad strategy”)

- CoupleVest helps resolve this by:
  1 making ideas concrete:
  Uses LLM for natural language (conviction) -> maths (code) and chart

2 simulator:
Uses reasoning LLM to find similar situation in the past and historical data for simulation

### Tech

LLM is used to convert natural language command like

     - “show me Tesla stock price in Euro”
     - “Apple always drops after earnings”

into code, code is executed producing charts or tables.

- Code is separately explained in natural language.
- Code is then executed to without any LLMs (aka verifiable AI)

Voyager paper by NVidia et al [https://voyager.minedojo.org/](https://voyager.minedojo.org/)

## Running

Create .env file with

```sh
FINNHUB_API_KEY=your_finnhub_api_key_here
```

## Negotiation Sample

🔊 ✨ Switch ON the AUDIO 🎧 ✅:

https://github.com/user-attachments/assets/79f96d90-5a42-4d45-80b5-7dc5f2f37fac

## Screenshots

### Goals

<img width="451" alt="image" src="https://github.com/user-attachments/assets/62667507-83e3-4ef8-b8ea-ba9eb77a8438" />

### Simulator

<img width="1060" alt="image" src="https://github.com/user-attachments/assets/25432da5-f415-4bf2-af26-f9a2a8931326" />

### Final Agreed Allocation

<img width="696" alt="image" src="https://github.com/user-attachments/assets/2c57145b-7509-4656-a1e8-4110f0dddd2e" />
