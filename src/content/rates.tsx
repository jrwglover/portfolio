import type { ReactNode } from 'react';
import { P, Eq, M, N, Diagram } from './prose';

// The explanation that opens each chapter of the Linear Rates Engine: what
// the quantity is, the relation that defines it, and what the engine measured.
// The panel that follows is the evidence for the text, not the other way
// round. Every number quoted here comes from the published JSON or the
// engine's test output.

const text: Record<string, ReactNode> = {

  'market-data-model': (
    <>
      <P>
        A curve is a discount function <M tex="P(t)" />, the value today of one unit paid at
        time <M tex="t" />. The equivalent description is the instantaneous forward rate,
      </P>
      <Eq tex={String.raw`f(t) = -\frac{d}{dt}\ln P(t), \qquad P(T) = \exp\!\Big(-\int_0^T f(u)\,du\Big),`} />
      <P>
        and most of what follows is easier to read in terms of <M tex="f" />, because it is the
        rate the curve says you earn over the next instant at <M tex="t" />. The market never
        quotes <M tex="P" /> or <M tex="f" /> directly. It quotes instruments: overnight index
        swaps, interest rate futures, forward rate agreements, fixed-for-floating swaps, tenor
        basis swaps, FX swap points and cross-currency basis. Each quote <M tex="q_k" /> is a
        constraint on the curve, because the instrument priced off the curve has to come back at
        its quoted value, <M tex="V_k(P;\,q_k) = 0" />.
      </P>
      <P>
        Every quote carries conventions, and the model treats them as data, with the same care as the
        quote itself. An ESTR OIS accrues ACT/360 and settles two days after trade, an
        AONIA OIS accrues ACT/365F and settles the next Sydney business day, AUD swaps switch
        from a quarterly 3M leg to a semi-annual 6M leg at three years. Get one convention
        wrong and the curve reprices that quote at a slightly different rate, and every forward
        after that pillar inherits the error. So the model stores each quote with its calendar,
        day count, settlement lag and frequency, and the panel shows exactly that.
      </P>
      <P>
        Fourteen curves are built from <N>348</N> instruments. After each build, every instrument
        is repriced off the finished curve and the difference from its quote reported. On the GPU
        path the marks match QuantLib to <N>10⁻¹⁴</N>, and at that level the only limit left is the
        arithmetic itself.
      </P>
    </>
  ),

  'bootstrapping': (
    <>
      <P>
        Bootstrapping is the inverse problem. Given <M tex="n" /> quotes on a curve, choose{' '}
        <M tex="n" /> pillar dates, treat the discount factors at the pillars as unknowns, and let
        an interpolation rule fill in everything between. The classical method solves pillar by
        pillar: the shortest instrument fixes the first pillar, the next instrument fixes the
        second with the first held, and so on. It works when each instrument depends only on
        earlier pillars. It breaks for a global interpolator, because a spline&apos;s shape
        between pillars <M tex="k" /> and <M tex="k+1" /> depends on pillar <M tex="k+2" />, so
        the earlier solve is wrong by the time the later one finishes. An earlier version of this
        engine did it that way and stopped converging on the long end.
      </P>
      <P>
        So every pillar on a curve is solved at once, as one Newton problem in <M tex="n" />{' '}
        unknowns with <M tex="n" /> repricing conditions, and each quote is repriced by the same
        finished curve it helped build. The interpolation is a cubic spline on{' '}
        <M tex="\ln P(t)" />. That choice has a direct consequence for the forwards:
      </P>
      <Eq tex={String.raw`\ln P(t)\ \text{piecewise cubic} \;\Longrightarrow\; f(t) = -\frac{d}{dt}\ln P(t)\ \text{piecewise quadratic and continuous.}`} />
      <P>
        Between pillars the forward bows, and the size of the bow grows with the square of the
        pillar gap. That is why the quote ladders run monthly to a year and annually to twelve
        years and never double their spacing, and why the instantaneous forward is the view
        to judge a build on. A curve can reprice every quote exactly and still have a forward
        nobody would hedge from. The other lesson I learned the hard way is that inputs matter
        more than interpolation: a set of quotes that is not arbitrage-consistent forces any
        interpolator to oscillate, because the only way to hit all of them is to bend.
      </P>
      <Diagram src="/diagrams/construction.svg"
        alt="Flowchart of curve construction: each quote maps to a rate helper chosen by its instrument type, including a float versus float basis swap helper for the 3s6s strip, and all of the helpers for a curve go into one global bootstrap that produces the calibrated term structure and its pillar dates, times and zeros."
        caption="How a curve is built. Each quote becomes a helper chosen by its instrument type, and one global solve takes every helper on the curve together." />
      <P>
        Projection and discounting are separate curves. A EURIBOR swap projects its floating leg
        off the EURIBOR 6M curve and discounts both legs on ESTR, so the EURIBOR curve can only be
        built after ESTR exists. That order comes from the dependency graph in chapter 9.
      </P>
    </>
  ),

  'meeting-dated-curves': (
    <>
      <P>
        An overnight rate moves when the central bank moves it, in steps on the dates its
        decisions take effect, and sits almost flat in between. A smooth spline through tenor
        OIS quotes draws a curve through those steps, so a decision expected in March is smeared
        across February and April. The meeting-dated build puts a pillar on every policy
        effective date instead. An OIS running from one effective date to the next pays the
        compounded overnight rate over exactly that period, so its quote gives the average
        overnight rate between two decisions,
      </P>
      <Eq tex={String.raw`\bar f_k = \frac{1}{\tau_k}\left(\frac{P(t_k)}{P(t_{k+1})} - 1\right),`} />
      <P>
        and the forward is held flat at <M tex="\bar f_k" /> across that interval. The short end
        is therefore a step function through the dated strip, and the cubic spline takes over
        beyond the last dated quote. The two pieces are joined by pinning the spline to the
        step curve&apos;s zero rates at the strip pillars, so the discount factor is continuous
        across the join and the long instruments still reprice.
      </P>
      <P>
        The panel shows four ESTR builds from the same overnight rate: tenor OIS, IMM-dated
        OIS, IMM-dated OIS with futures for the second year, and the ECB-dated build the book
        prices on. The futures build needs one correction. A futures contract settles daily, so
        its implied rate sits above the forward by a convexity term,
      </P>
      <Eq tex={String.raw`f = \frac{100 - \text{price}}{100} - \tfrac{1}{2}\sigma^2 t_1 t_2,`} />
      <P>
        with <M tex="\sigma" /> the rate volatility and <M tex="t_1, t_2" /> the start and end of
        the contract period. Add EURIBOR 6M to the chart to see where the four ESTR builds
        disagree and by how much.
      </P>
    </>
  ),

  'fx-and-cross-currency': (
    <>
      <P>
        A euro cash flow collateralised in dollars has to be discounted on a euro curve that is
        consistent with dollar collateral, and no euro instrument quotes that curve. It is
        implied. Covered interest parity ties the FX forward to the two discount curves,
      </P>
      <Eq tex={String.raw`F(T) = S\,\frac{P^{\text{USD-coll}}_{\text{EUR}}(T)}{P_{\text{USD}}(T)} \quad\Longrightarrow\quad P^{\text{USD-coll}}_{\text{EUR}}(T) = \frac{F(T)}{S}\,P_{\text{USD}}(T),`} />
      <P>
        so FX swap points out to two years and cross-currency basis swaps beyond give the curve
        directly, once SOFR is built. The basis is the premium for borrowing dollars against
        euros, and it is why the implied curve sits apart from ESTR. The same construction gives
        the AUD curve under USD collateral from AUD/USD points and basis.
      </P>
      <P>
        One more curve is derived from the others without a bootstrap of its own. Under a CSA that accepts USD, EUR or
        AUD cash, whoever posts collateral delivers whichever is cheapest and can switch daily.
        With no volatility assumed, the cheapest-to-deliver discount curve takes the highest
        forward of the three collateral curves at every instant,
      </P>
      <Eq tex={String.raw`f_{\text{ctd}}(t) = \max\big(f_{\text{SOFR}}(t),\, f_{\text{EUR/USD}}(t),\, f_{\text{AUD/USD}}(t)\big), \qquad P_{\text{ctd}}(T) = \exp\!\Big(-\int_0^T f_{\text{ctd}}\Big).`} />
      <P>
        The result has kinks where the maximum switches from one curve to another, and the GPU
        carries it as an exact table of regions, since a spline would smooth the kinks away. One known limitation sits in
        this chapter. FX points that span the year-end carry a turn premium, and the spline
        absorbs it as a dip of about <N>25bp</N> in the instantaneous forward either side of
        31 December. The proper treatment is an explicit jump in the overnight forward on the turn
        dates, with a clean curve interpolated around it, and it is on my list.
      </P>
    </>
  ),

  'trade-risk': (
    <>
      <P>
        PV01 answers one question: how much does the value of a trade change when a rate moves
        one basis point? There are three answers because &quot;a rate&quot; can mean three
        things, and a desk needs all three.
      </P>
      <P>
        <strong style={{ color: 'var(--text-primary)' }}>Market PV01</strong> bumps a quoted
        instrument, rebuilds the curve, and reprices the trade. The bar for the 10Y swap is{' '}
        <M tex="\partial V / \partial q_{10Y}" />, the quantity you hedge with a 10Y swap, so there is
        one bar per quote. <strong style={{ color: 'var(--text-primary)' }}>Zero
        PV01</strong> bumps the zero rate at one pillar with a tent weight that falls to zero at
        the neighbouring pillars,
      </P>
      <Eq tex={String.raw`P_i^{\epsilon}(t) = P(t)\,e^{-\epsilon\, w_i(t)\,t}, \qquad \sum_i w_i(t) = 1 \ \text{for all } t,`} />
      <P>
        so the pillar ladder adds up to a parallel shift exactly, and nothing is counted twice.{' '}
        <strong style={{ color: 'var(--text-primary)' }}> Forward PV01</strong> bumps the
        instantaneous forward between two pillars only, which tells you where in time the
        exposure sits. Same risk, three coordinate systems. The totals agree and the shapes do
        not, and the difference between them is a Jacobian, not a disagreement.
      </P>
      <P>
        The cashflow schedule underneath is generated from the trade&apos;s conventions and
        valued off the same curves as the risk. A seasoned trade is the case worth checking: its
        running coupon has already fixed, so that cashflow is a settled number that must not
        move when the curve does, and the panel shows it priced that way. Errors are measured
        against notional, because a par swap has an NPV near zero and a
        relative-to-NPV figure explodes there.
      </P>
    </>
  ),

  'cost': (
    <>
      <P>
        Valuing a swap as an object means building its schedule, then calling the curve once
        per cashflow through a virtual function. Measured on this machine, per cashflow, that
        costs <N>2.03 µs</N> through QuantLib&apos;s swap objects, <N>0.249 µs</N> through a flat
        loop over cashflow arrays that still calls the curve virtually, and <N>0.029 µs</N>{' '}
        through the raw spline coefficients. Leaving the object model is worth sixty-five to
        seventy times on a single core. The GPU then adds a factor of one to 1.7 at 6.2 million
        cashflows, and on bucketed curve risk it never beat the flattened CPU at any book size I
        measured. The old headline of an eight times GPU win was measuring QuantLib&apos;s
        overhead, not the device.
      </P>
      <P>
        The bigger idea is to stop touching trades at all. The value of the book is a sum over
        cashflows, and every cashflow is either a fixed amount discounted on one curve or a
        floating amount that is a ratio of projection discount factors times a discounting one,
      </P>
      <Eq tex={String.raw`V = \sum_{j} c_j\, P_d(t_j) \;+\; \sum_{m} c_m\, \frac{P_p(s_m)}{P_p(e_m)}\, P_d(t_m).`} />
      <P>
        Two cashflows on the same curves and the same dates can add their coefficients before
        any curve is read. Collapsing the book that way turns <N>4.0m</N> cashflows into{' '}
        <N>159,146</N> terms, and a revaluation or a risk run walks the terms. The panel times a
        full risk run five ways as the book grows, and the collapse section shows where the time
        goes once the trades are out of the loop.
      </P>
    </>
  ),

  'trade-feed': (
    <>
      <P>
        None of this matters if the book cannot get from trade capture to the risk platform in
        time. The end-of-day feed shipped a 25,000-trade book as a <N>255 MB</N> extract, because
        the extract wrote every trade once per schedule period, with the header repeated on each
        row, and a million rows were crossing a <N>0.19 MB/s</N> link. The slow part was never
        the computation.
      </P>
      <P>
        The bridge reads the flat file with an explicit schema, re-nests each trade so its
        periods and exercise dates become array columns of one row, and writes compressed
        Parquet, and the file comes out <N>15.9×</N> smaller. Trades missing a field the pricing step
        needs go to a quarantine for review, so nothing is silently dropped. The database load runs over eight parallel
        connections, and counts, notionals and an id hash are reconciled at every hop.
      </P>
      <P>
        Measured at the production transfer rate the file moves <N>127×</N> faster, 22.4 minutes
        down to 10.6 seconds, and the database load is <N>49×</N> faster than a single
        connection, with zero breaks across <N>1,035,762</N> reconciled rows. At this scale the
        gain comes from the format and the transfer. On one node a single-threaded Python pass
        over the same file beats Spark, so Spark earns its keep on the parallel load and once
        the book outgrows one machine.
      </P>
    </>
  ),

  'why-events': (
    <>
      <P>
        Most curve systems rebuild every curve on a timer. Set the interval long and a trader can
        be looking at a stale curve while the market moves. Set it short and all fourteen curves
        rebuild every cycle whether or not any price changed, and on most cycles none has. The choice of
        interval is a choice between two kinds of waste, and no setting removes both.
      </P>
      <P>
        An event-driven engine takes the price change itself as the unit of work. Each price
        belongs to one curve, the dependency graph says which other curves are built on it, and
        only that set is rebuilt. Everything else keeps the version it already has. Prices that
        arrive together are coalesced first, so a burst of <N>120</N> prices in one cycle produces
        a single rebuild of each affected curve.
      </P>
      <P>
        The harder requirement is consistency. If curves are rebuilt one at a time and a reader
        is pricing while they change, it can read ESTR from one moment and EURIBOR from another,
        and the book it values never existed. So curves are published as immutable sets, each
        stamped with an epoch, and a reader holds one set for the whole of a calculation. Two
        readers checking continuously while the engine rebuilt underneath them never found an
        inconsistent set. When a solve fails, the last good version of that curve is served and
        marked stale, and the rest of the set carries on.
      </P>
    </>
  ),

  'what-one-price-touches': (
    <>
      <P>
        The engine does not guess which curves depend on which. The registry that the batch
        engine already uses declares, for every curve, the discount curve it is built on, the
        index curve it projects from and the FX pair it is implied against, and the dependency
        graph is derived from those declarations. That matters because the two engines then
        cannot disagree about the structure of the market.
      </P>
      <P>
        A change to curve <M tex="c" /> invalidates <M tex="c" /> and every descendant of{' '}
        <M tex="c" /> in the graph, and the invalidated set is rebuilt in topological order, each
        curve at most once even when several of its inputs moved together. A SONIA quote rebuilds
        SONIA and nothing else. A SOFR quote rebuilds SOFR, then both cross-currency curves that
        are implied against it, then the cheapest-to-deliver curve built on those.
      </P>
      <Diagram src="/diagrams/curve-graph.svg" minWidth={1000}
        alt="Curve dependency graph: four pricing curves build independently, one per currency; EURIBOR 6M and the two BBSW curves are discounted on their currency's meeting-dated curve; the two BBSW curves are linked by the 3s6s tenor basis strip and solve as one unit; the cross-currency curves are implied against SOFR, and the cheapest-to-deliver curve is derived from them."
        caption="The dependency graph, derived from the registry. The curve at the head of an arrow is built on the one at its tail." />
      <P>
        One structure needs more than an order. The two BBSW curves read each other through the
        3s6s basis swaps, so they form a cycle. The engine stages that pair and iterates the
        joint solve to a fixed point, three passes to <N>1e-12</N>, and treats the pair as one
        unit of the graph. Pick a curve on the panel to see the set its change forces to rebuild.
      </P>
    </>
  ),

  'session-replay': (
    <>
      <P>
        Each cycle of the engine does the same five things. It drains the tick queue, dropping
        repeats and ordering late arrivals. It rebuilds the curves the surviving ticks
        invalidate, in dependency order. It publishes the result as a new set with the next
        epoch. It reprices the collapsed book on that set, and it runs the risk ladders and a
        full-revaluation VaR over the most recent 250 days of the generated scenario history.
        The replay records each of those clocks per step, and the steps come to a few hundred
        milliseconds end to end on a book of <N>150,160</N> trades.
      </P>
      <P>
        The session is a recording of the engine fed a scripted stream of prices with repeats
        and out-of-order arrivals, including one solver failure, so that the failure path gets
        exercised. Tickets arrive during the session and are dealt at the
        market on the set they land on. They run unhedged against the limits intraday, and that is
        the story the Limits chapter tells. They are hedged at the close, before the end-of-day
        marks in chapter 13.
      </P>
    </>
  ),

  'limits': (
    <>
      <P>
        A limit here is a cap on the net market PV01 of one curve, the sum of that curve&apos;s
        bars in chapter 5, with utilisation defined as
      </P>
      <Eq tex={String.raw`u_c = \frac{\left|\sum_k \partial V/\partial q_{c,k}\right|}{L_c}.`} />
      <P>
        Limits live in the quote space the desk deals in, because the hedge for a breach is a
        quoted instrument. They are evaluated on every published set whose market run completed,
        and a set whose market run was skipped because a curve was stale is not evaluated, since
        a known-incomplete number should not be compared with a limit as if it were whole.
      </P>
      <P>
        The levels are illustrative. What is measured is the utilisation under them, and the
        session is built so that it tells a story the desk would recognise: everything inside at
        the open, then large EURIBOR receivers dealt late in the session that take the EURIBOR
        line through its limit on the gap set and keep it there to the close. The same tickets
        are hedged at the close, so the end-of-day book in later chapters looks like a
        flow book again.
      </P>
    </>
  ),


  'value-at-risk': (
    <>
      <P>
        Value at risk is the loss the book should not exceed on 99 days in 100. It is the
        1% quantile of the daily P&amp;L distribution with the sign flipped, and expected
        shortfall is the average loss on the days beyond it,
      </P>
      <Eq tex={String.raw`\text{VaR}_{99} = -Q_{0.01}(\Delta V), \qquad \text{ES}_{99} = -\,\mathbb{E}\big[\Delta V \,\big|\, \Delta V \le Q_{0.01}(\Delta V)\big], \qquad \text{VaR}_{10d} = \sqrt{10}\,\text{VaR}_{1d}.`} />
      <P>
        The engine computes it by historical simulation in the shape CRR Art. 365 asks for:
        the whole book is fully revalued under each of the 250 most recent business days of
        curve moves, and again under a one-year window of stress. Real market history cannot
        ship with this site, so the history is generated from a factor model correlated across
        curves and tenors with Student-t tails, and its volatility regimes follow the actual
        chronology: the 2008 crisis at 3.5 times normal with fatter tails, March 2020 at 2.5,
        the 2022 to 2023 hiking cycle at 1.8. The revaluations under that history are measured,
        and so is the cost of them.
      </P>
      <P>
        On the closing book the one-day 99% VaR is <N>823,441</N> and the expected shortfall
        <N>973,007</N>. The stressed window runs from 10 October 2008 to 24 September 2009 and
        gives <N>3,153,890</N>, 3.8 times the trailing figure. The backtest counts the days the
        loss exceeded the VaR predicted the day before: <N>63</N> exceptions in <N>4,603</N> days
        since 2009 and <N>3</N> in the last 250, which is the green zone of the Basel traffic
        light. The cost is the point of the collapsed lane: <N>5,126</N> full revaluations in
        <N>762 ms</N>, 149 µs each, where a trade-by-trade revaluation takes 53.6 ms per
        scenario.
      </P>
    </>
  ),

  'stress-scenarios': (
    <>
      <P>
        A stress is a named deterministic shock, the kind a risk committee asks about. Each
        one is a shift defined at twelve pillars from one month to thirty years, read
        piecewise-linearly between them and flat beyond, and applied to every curve as an
        overlay on the published discount factors,
      </P>
      <Eq tex={String.raw`P^{s}(t) = P(t)\,e^{-s(t)\,t}, \qquad \text{P\&L} = V\big(P^{s}\big) - V\big(P\big),`} />
      <P>
        with the book fully revalued under each, for the whole desk and for each book within
        it. The six here are a parallel rise and fall of 100bp, a steepener and a flattener
        of 20bp at the front against 40bp at thirty years, a basis widening, and an AUD-only
        rise of 50bp.
      </P>
      <P>
        On the closing book the parallel rise gains <N>8.75m</N> and the parallel fall loses
        <N>10.74m</N>. The asymmetry is convexity: the hedged book is left net paid, and a paid
        position gains less on a rise than it loses on an equal fall. The steepener and the
        flattener come to <N>4.19m</N> and <N>-4.25m</N>, the basis widening to <N>5.84m</N>,
        and the AUD shock to <N>3.65m</N>, which is the first time the AUD book has had a number
        of its own on this page.
      </P>
    </>
  ),

  'engine-output': (
    <>
      <P>
        The same run, written down twice. The engine output is what the process prints per
        cycle: the ticks applied and dropped, the curves rebuilt and how long each took, the set
        published, and anything that failed. It is the log you would read when something looks
        wrong. The trader output is the same cycles as a desk would see them: which curves moved,
        by how much at the tenors that matter, and what the book and its risk did as a result.
      </P>
      <P>
        Keeping both is deliberate. A number on the trader view has to be traceable to a line in
        the engine log, and a pass of the one against the other is the check that the replay
        shows what actually happened.
      </P>
    </>
  ),

  'eod-marking': (
    <>
      <P>
        During the day the desk trades on the meeting-dated model. At the close the book is
        marked on a separate end-of-day family: <N>9</N> curves built from <N>149</N> instruments
        at standard tenors and real market conventions, the set an independent price
        verification process compares against. The two families are built on the same
        machinery, and the end-of-day quotes are implied from the trading snapshot through each
        instrument&apos;s own helper, so the family reprices its inputs to a round trip of{' '}
        <N>3.4e-10 bp</N>. The valuation difference between the families, the model basis, is{' '}
        <N>-110,130</N> on a book of about 444m, and it is attributed curve by curve.
      </P>
      <P>
        Consensus services such as Totem collect each contributor&apos;s mid for every
        instrument, reject outliers, and return the mean, the standard deviation and the
        percentiles of what remains. The marks here are checked against a generated run with
        that structure. For each quote the test is the distance from the consensus mid relative
        to the half bid/offer <M tex="h" />,
      </P>
      <Eq tex={String.raw`d_k = \frac{|\,m_k - \bar q_k\,|}{h_k}, \qquad d_k < 0.5\ \text{pass}, \quad d_k < 1\ \text{watch}, \quad \text{else flag},`} />
      <P>
        which is the independent verification of marks that CRR Art. 105 requires, done per
        instrument so that a flag names a quote and a reviewer knows exactly where to look. Trader overrides on the
        panel are revalued to first order off the engine&apos;s bump-and-resolve Jacobian, so the
        effect of a changed mark on the book shows immediately.
      </P>
      <P>
        The second tab turns the same test on the trading curves themselves: their{' '}
        <N>242</N> quotes against a separate consensus run, and the internal lanes that price
        the whole book two independent ways and compare the live construction with its
        alternatives.
      </P>
    </>
  ),

  'prudent-valuation': (
    <>
      <P>
        Fair value is the mid. Prudent value is the point in the range of plausible prices at
        which the bank is 90% confident it could exit, and the additional valuation adjustment is
        the gap between the two, deducted from CET1. For a rates book the uncertainty lives in
        the quotes, so the AVAs are computed quote by quote. With <M tex="s_k" /> the book&apos;s
        sensitivity to quote <M tex="k" />, <M tex="\sigma_k" /> the consensus standard deviation
        and <M tex="h_k" /> the half bid/offer,
      </P>
      <Eq tex={String.raw`u_k = 1.2816\,\sigma_k, \qquad \text{MPU}_k = \max\!\big(0,\ |s_k|\,u_k - s_k\,\delta_k\big), \qquad \text{CoC}_k = |s_k|\,h_k,`} />
      <P>
        where <M tex="1.2816" /> is the 90th percentile of a normal, the prudent side is whichever
        of the 10th and 90th percentiles hurts the book, and <M tex="\delta_k" /> is the distance
        from the mark to the consensus mid, so that a mark already on the prudent side is not
        charged twice. Market price uncertainty is Art. 9 of Delegated Regulation (EU) 2016/101
        and close-out cost is Art. 10. The Annex then aggregates with a 50% factor. For
        these two categories that means half of each per-quote figure, floored at zero.
      </P>
      <P>
        The regulation allows the sensitivity route, which multiplies the Jacobian by the
        prudent shift. I built the full route as well: move each quote to its prudent level,
        re-bootstrap the end-of-day family and revalue the whole book, <N>449</N> real curve
        rebuilds, every one of which reprices its shifted quote to within <N>5.3e-10 bp</N>. The
        two routes agree to <N>0.20%</N> on market price uncertainty and <N>0.31%</N> on
        close-out cost. That gap is the sensitivity route&apos;s linearity error, and it is printed
        per instrument. The result on this book is <N>1,246,600</N> of market price uncertainty and{' '}
        <N>1,974,000</N> of close-out cost before aggregation, and a CET1 deduction of{' '}
        <N>1,611,240</N> after it. The consensus behind these numbers is generated.
      </P>
    </>
  ),


  'ava-table': (
    <>
      <P>
        The prudent valuation chapter computed the two categories that dominate a rates
        book. The technical standard has nine, Articles 9 to 17: market price uncertainty,
        close-out costs, model risk, unearned credit spreads, investing and funding costs,
        concentrated positions, future administrative costs, early termination and
        operational risk. A deduction that lists only the two it can size is not a prudent
        valuation, so this chapter shows the whole table.
      </P>
      <P>
        The first two rows are the end-of-day full-revaluation figures from the previous
        chapter, and the close-out table beside them is the same result grouped by curve.
        Model risk, Article 11, is sized from this engine&apos;s own alternative
        constructions: the live EUR discount curve is the meeting-dated build, and the worst
        absolute spread of the book&apos;s value across the tenor and IMM builds of the same
        market is <N>1,627,810</N>, or <N>813,904</N> after the 50% weighting. The six remaining
        rows say why they are not modelled here, and each reason is a real gap: there is no
        counterparty in this book, so no CVA; discounting at the collateral rate is assumed to
        capture funding; there is no market-depth or exit-horizon data to size concentration
        honestly. With model risk included the deduction comes to
      </P>
      <Eq tex={String.raw`\text{AVA} = \sum_{i} \alpha\,\text{AVA}_i = 624{,}245 + 986{,}998 + 813{,}904 = 2{,}425{,}147, \qquad \alpha = 0.5.`} />
    </>
  ),

  'talk': (
    <>
      <P>
        Ten minutes through the whole pipeline, from a market quote to the capital deduction,
        with the regulatory change that created the need for it: the old prudent valuation rules
        had no confidence level, and the 2016 technical standard put one at 90%. The slides use
        the numbers from the chapters before this one. I present from the full-screen version,
        with the speaker notes in a separate window.
      </P>
    </>
  ),


  'model-inventory': (
    <>
      <P>
        A model validation function asks three things of a curve engine: which models are in
        use, what each one is built from, and what evidence says it works. This is the
        inventory. Every curve in the registry is listed with its construction (a par OIS
        bootstrap, a dual-curve build, an implied cross-currency curve or a derived one), its
        interpolation, the curves it depends on, and the checks the engine ran against the
        final published set.
      </P>
      <P>
        The checks are the ones the earlier chapters rely on: the collapsed lane reconciled
        against trade-by-trade pricing, the risk ladder&apos;s sum compared with a flat
        one-basis-point shift, and the round trip of the daily table back through the curve.
        A check that did not run says so, and the reason on the comparison curves is that
        nothing prices on them. One check is flagged on purpose. The BBSW 3M curve shows a
        <N>2e-4</N> gap between the staged basis solve and its published table, and I have
        left it visible because an inventory that hides its one flag is not worth much.
      </P>
    </>
  ),

  'architecture': (
    <>
      <P>
        The diagrams follow the C4 convention: the system in its context, the containers inside
        the host process, and the sequence of one valuation run. The boundary worth reading
        closely is the one between host and device. The processor builds every curve and
        extracts the spline coefficients the curve is already made of. One copy moves those
        coefficients to the GPU, and the device evaluates them directly, so the two paths work
        from identical numbers and the reconciliation downstream has something exact to check.
      </P>
      <P>
        The build order comes from the dependency graph: EURIBOR needs ESTR first, the
        cross-currency curves need SOFR first, and the BBSW pair is solved as one unit. Nothing in
        the browser prices anything. The pages render what the engine exported.
      </P>
    </>
  ),
};

export default text;
