[Slides](https://docs.google.com/presentation/d/1FqsUKDC_I9WGmk3FYcngcpW-bZZqL0hpEo-0RNdobKA/edit#slide=id.p)


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
