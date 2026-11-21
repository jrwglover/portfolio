import type { ReactNode } from 'react';
import { P, Eq, M, N, Diagram } from './prose';

// The notes shown above each panel of the Linear Rates Engine: what
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
        and most of what follows is easier to read in terms of <M tex="f" />, the rate the
        curve says is earned over the next instant at <M tex="t" />. The market quotes neither{' '}
        <M tex="P" /> nor <M tex="f" />. It quotes instruments such as overnight index swaps,
        futures, forward rate agreements, swaps, basis swaps and FX points. Each quote{' '}
        <M tex="q_k" /> is a constraint on the curve, since the instrument priced off the curve
        has to come back at its quoted value, <M tex="V_k(P;\,q_k) = 0" />.
      </P>
      <P>
        Every quote carries conventions, and the model stores them with the quote. An ESTR OIS
        accrues ACT/360 and settles two days after trade, a SONIA OIS accrues ACT/365F and
        settles the same day, and a EURIBOR swap pays annually against a semi-annual floating
        leg. One wrong convention reprices that quote at a slightly different rate, and every
        forward after that pillar inherits the error. The panel shows each quote with its
        calendar, day count, settlement lag and frequency.
      </P>
      <P>
        The curves are built from <N>232</N> rate instruments and <N>18</N> bonds. After each build, every instrument
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
        an interpolation rule fill in everything between. The classical method solves one pillar
        at a time, each instrument fixing the next pillar with the earlier ones held. That works
        when each instrument depends only on earlier pillars. With a spline it does not, because
        the shape between pillars <M tex="k" /> and <M tex="k+1" /> depends on pillar{' '}
        <M tex="k+2" />. An earlier version of this engine solved that way and stopped
        converging on the long end.
      </P>
      <P>
        So every pillar on a curve is solved at once, as one Newton problem in <M tex="n" />{' '}
        unknowns with <M tex="n" /> repricing conditions, and each quote is repriced by the same
        finished curve it helped build. EURIBOR 6M and the cross-currency curve are cubic
        splines on <M tex="\ln P(t)" />, and that choice has a direct consequence for their
        forwards:
      </P>
      <Eq tex={String.raw`\ln P(t)\ \text{piecewise cubic} \;\Longrightarrow\; f(t) = -\frac{d}{dt}\ln P(t)\ \text{piecewise quadratic and continuous.}`} />
      <P>
        Between pillars the forward bows, and the bow grows with the square of the pillar gap.
        That is why the quote ladders run monthly to a year and annually to twelve years, and
        why the instantaneous forward is the view to judge a build on. A curve can reprice every
        quote and still have a forward nobody would hedge from. Inputs matter more than
        interpolation. A set of quotes that is not arbitrage-consistent makes any interpolator
        oscillate, because bending is the only way to hit all of them.
      </P>
      <P>
        The OIS curves use the min-curve spline on the zero rate. Its slopes come from the
        natural spline equations for evenly spaced pillars, applied as they stand to pillars
        that are not. Where neighbouring gaps are equal the curvature is continuous, and where
        the gap changes only the slope is. The forward kinks at those pillars, at 2Y, 10Y, 13Y,
        15Y and 20Y on the meeting-dated curves. On the tenor ESTR curve they fall at 2Y, 12Y,
        15Y and 30Y. Against the generating curve the kinks come to 2 to 5 bp, and the zero rates
        stay within half a basis point. The tenor ESTR curve is built on the standard OIS ladder,
        monthly to a year and annual to twelve years, with an O/N deposit in front and the curve
        starting on the trade date.
      </P>
      <Diagram src="/diagrams/construction.svg"
        alt="Flowchart of curve construction: each quote maps to a rate helper chosen by its instrument type, including a float versus float basis swap helper for the 3s6s strip, and all of the helpers for a curve go into one global bootstrap that produces the calibrated term structure and its pillar dates, times and zeros."
        caption="How a curve is built. Each quote becomes a helper chosen by its instrument type, and one global solve takes every helper on the curve together." />
      <P>
        Projection and discounting are separate curves. A EURIBOR swap projects its floating leg
        off the EURIBOR 6M curve and discounts both legs on ESTR, so the EURIBOR curve can only be
        built after ESTR exists. That order comes from the dependency graph in What one price touches.
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
        is therefore a step function through the dated strip, and the min-curve spline takes
        over beyond the last dated quote. The two pieces are joined by pinning the spline to the
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
        euros, and it is why the implied curve sits apart from ESTR.
      </P>
      <P>
        One more curve is derived from the others without a bootstrap of its own. Under a CSA that accepts more than one
        currency as cash, whoever posts collateral delivers whichever is cheapest and can
        switch daily. With no volatility assumed, the cheapest-to-deliver discount curve takes
        the highest forward of the collateral curves at every instant,
      </P>
      <Eq tex={String.raw`f_{\text{ctd}}(t) = \max\big(f_{\text{SOFR}}(t),\, f_{\text{EUR/USD}}(t)\big), \qquad P_{\text{ctd}}(T) = \exp\!\Big(-\int_0^T f_{\text{ctd}}\Big).`} />
      <P>
        The result has kinks where the maximum switches from one curve to another, so the GPU
        carries it as a table of regions, where a spline would smooth the kinks away. One
        known limitation sits in this panel. FX points that span the year end carry a turn
        premium, and the spline absorbs it as a dip of about <N>25bp</N> in the instantaneous
        forward either side of 31 December. The proper treatment is an explicit jump in the
        overnight forward on the turn dates, and it is on the list.
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
        Valuing a swap as an object means building its schedule and calling the curve once per
        cashflow through a virtual function. On this machine that costs <N>2.03 µs</N> per
        cashflow through QuantLib&apos;s swap objects, <N>0.249 µs</N> through a flat loop over
        cashflow arrays, and <N>0.029 µs</N> through the raw spline coefficients. Leaving the
        object model is worth about seventy times on a single core. The GPU then adds a factor
        of one to 1.7 at 6.2 million cashflows, and on bucketed curve risk it did not beat the
        flattened CPU at any book size measured. An earlier headline of an eight times GPU win
        had been measuring QuantLib&apos;s overhead.
      </P>
      <P>
        The bigger idea is to stop touching trades at all. The value of the book is a sum over
        cashflows, and every cashflow is either a fixed amount discounted on one curve or a
        floating amount that is a ratio of projection discount factors times a discounting one,
      </P>
      <Eq tex={String.raw`V = \sum_{j} c_j\, P_d(t_j) \;+\; \sum_{m} c_m\, \frac{P_p(s_m)}{P_p(e_m)}\, P_d(t_m).`} />
      <P>
        Two cashflows on the same curves and the same dates can add their coefficients before
        any curve is read. Collapsing the book that way turns <N>3.8m</N> cashflows into{' '}
        <N>104,725</N> terms, and a revaluation or a risk run walks the terms. The panel times a
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
        be looking at a stale curve while the market moves. Set it short and all ten curves
        rebuild every cycle whether or not any price changed, and on most cycles none has. The choice of
        interval is a choice between two kinds of waste, and no setting removes both.
      </P>
      <P>
        An event-driven engine takes the price change itself as the unit of work. Each price
        belongs to one curve, the dependency graph says which other curves are built on it, and
        only that set is rebuilt. Everything else keeps the version it already has. Prices that
        arrive together are coalesced first, so a burst of <N>120</N> prices in one cycle produces
        a single rebuild of each affected curve. The same applies to an input that is not a
        price. A change in a bond&apos;s terms is an event too, and it rebuilds the one curve
        built from that bond.
      </P>
      <P>
        The harder requirement is consistency. A reader pricing while curves are rebuilt one at
        a time can take ESTR from one moment and EURIBOR from another, and value a book that
        existed at neither. So curves are published as immutable sets, each stamped with an
        epoch, and a reader holds one set for a whole calculation. Two readers checking
        continuously while the engine rebuilt underneath them found no inconsistent set. When a
        solve fails, the last good version of that curve is served and marked stale.
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
        alt="Curve dependency graph: three pricing curves build independently, one per currency; EURIBOR 6M is discounted on the meeting-dated ESTR curve; the EUR/USD cross-currency curve is built on ESTR ECB and SOFR; FX forwards and the USD CSA cheapest-to-deliver curve are derived from the result."
        caption="The dependency graph, derived from the registry. The curve at the head of an arrow is built on the one at its tail." />
      <P>
        The government bond curve has no parent and no child, like SONIA, so a bond price
        rebuilds it and nothing else.
      </P>
      <P>
        Pick a curve on the panel to see the set its change forces to rebuild.
      </P>
    </>
  ),

  'session-replay': (
    <>
      <P>
        Each cycle does the same five things. It drains the tick queue, rebuilds the curves the
        ticks invalidate in dependency order, publishes the result as a new set, reprices the
        collapsed book on it, and runs the risk ladders and a full-revaluation VaR over the most
        recent 250 days of generated history. The replay records each of those clocks, and a
        step comes to a few hundred milliseconds end to end on a book of <N>150,103</N> trades.
      </P>
      <P>
        The first three clocks are the ones a trader waits on. Across the nine cycles of the
        session that rebuild a rate curve, the time from draining the queue to refreshed value
        and risk ladders has a median of <N>183 ms</N> and a slowest cycle of <N>234 ms</N>.
        The curve rebuild is most of that time. Revaluing every trade takes about{' '}
        <N>6 ms</N> and the ladders about <N>29 ms</N>. A cycle that rebuilds only the
        government bond curve solves it in about <N>4.5 ms</N>.
      </P>
      <P>
        The session is a recording of the engine fed a scripted stream of prices with repeats
        and out-of-order arrivals, including one solver failure, so that the failure path gets
        exercised. Tickets arrive during the session and are dealt at the
        market on the set they land on. They run unhedged against the limits intraday, and that is
        the story the Limits page tells. They are hedged at the close, before the end-of-day
        marks in EOD marking and IPV. The last eight steps are bond prices and static
        records, shown on the Government bonds page.
      </P>
    </>
  ),

  'limits': (
    <>
      <P>
        A limit here is a cap on the net market PV01 of one curve, the sum of that curve&apos;s
        bars in Trade risk and cashflows, with utilisation defined as
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
        are hedged at the close, so the end-of-day book in the later pages looks like a
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
        The engine computes it by historical simulation in the shape CRR Art. 365 asks for.
        The whole book is revalued under each of the 250 most recent business days of curve
        moves, and again under a one-year window of stress. Real market history cannot ship
        with this site, so the history is generated from a factor model correlated across
        curves and tenors with Student-t tails. Its volatility regimes follow the real
        chronology, with 2008 at 3.5 times normal, March 2020 at 2.5 and the 2022 to 2023
        hiking cycle at 1.8.
      </P>
      <P>
        On the closing book the one-day 99% VaR is <N>839,782</N> and the expected shortfall{' '}
        <N>892,479</N>. The stressed window runs from 10 October 2008 to 24 September 2009 and
        gives <N>2,942,780</N>. The backtest counts the days the loss exceeded the VaR predicted
        the day before, <N>67</N> exceptions in <N>4,603</N> days since 2009 and <N>6</N> in
        the last 250, which is the amber zone of the Basel traffic light. The collapsed lane is
        what makes this affordable, <N>5,126</N> full revaluations in <N>370 ms</N>.
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
        it. The five here are a parallel rise and fall of 100bp, a steepener and a flattener
        of 20bp at the front against 40bp at thirty years, and a basis widening.
      </P>
      <P>
        On the closing book the parallel rise gains <N>6.05m</N> and the parallel fall loses{' '}
        <N>7.18m</N>. The asymmetry is convexity: the hedged book is left net paid, and a paid
        position gains less on a rise than it loses on an equal fall. The steepener and the
        flattener come to <N>1.45m</N> and <N>-1.49m</N>, and the basis widening to <N>3.77m</N>.
      </P>
    </>
  ),

  'engine-output': (
    <>
      <P>
        The same run written down twice. The engine output is what the process prints per
        cycle, the ticks applied and dropped, the curves rebuilt and how long each took, the set
        published and anything that failed. The trading view shows the same cycles as a desk
        would read them, which curves moved, by how much at the tenors that matter, and what
        the book and its risk did as a result. Every number on the trading view traces to a line
        in the log.
      </P>
    </>
  ),

  'eod-marking': (
    <>
      <P>
        During the day the desk trades on the meeting-dated model. At the close the book is
        marked on a separate end-of-day family of <N>9</N> curves built from <N>149</N>{' '}
        instruments at standard tenors, the set an independent price verification compares
        against. The end-of-day quotes are implied from the trading snapshot through each
        instrument&apos;s own helper, so the family reprices its inputs to <N>3.5e-10 bp</N>.
        The valuation difference between the families, the model basis, is <N>-241,623</N> on a
        book of about 454m, attributed curve by curve.
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
        <N>144</N> quotes against a separate consensus run, and the internal lanes that price
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
        prudent shift. The full route is built as well. It moves each quote to its prudent
        level, re-bootstraps the end-of-day family and revalues the whole book, <N>449</N> curve
        rebuilds in all. The two routes agree to <N>0.49%</N> on market price uncertainty and{' '}
        <N>0.38%</N> on close-out cost, and the gap is printed per instrument. On this book that
        is <N>968,791</N> of market price uncertainty, <N>1,575,150</N> of close-out cost, and a
        CET1 deduction of <N>1,267,740</N> after aggregation. The consensus behind these numbers
        is generated.
      </P>
    </>
  ),


  'ava-table': (
    <>
      <P>
        Prudent valuation computed the two categories that dominate a rates
        book. The technical standard has nine, Articles 9 to 17: market price uncertainty,
        close-out costs, model risk, unearned credit spreads, investing and funding costs,
        concentrated positions, future administrative costs, early termination and
        operational risk. A deduction that lists only the two it can size is not a prudent
        valuation, so this page shows the whole table.
      </P>
      <P>
        The first two rows are the end-of-day full-revaluation figures from the prudent
        valuation panel, and the close-out table beside them is the same result grouped by
        curve. Model risk, Article 11, is sized from the engine&apos;s own alternative
        constructions. The worst spread of the book&apos;s value across the tenor and IMM builds
        of the same market is <N>1.99m</N>, or <N>994,994</N> after the 50% weighting. The
        six remaining rows say why they are not modelled here. There is no counterparty in this
        book, discounting at the collateral rate is assumed to cover funding, and there is no
        market-depth data to size concentration. With model risk included the deduction comes to
      </P>
      <Eq tex={String.raw`\text{AVA} = \sum_{i} \alpha\,\text{AVA}_i = 480{,}162 + 787{,}574 + 994{,}994 = 2{,}262{,}730, \qquad \alpha = 0.5.`} />
    </>
  ),


  'model-inventory': (
    <>
      <P>
        A model validation function asks three things of a curve engine: which models are in
        use, what each one is built from, and what evidence says it works. This is the
        inventory. Every curve in the registry is listed with its construction (a par OIS
        bootstrap, a dual-curve build, an implied cross-currency curve, a government bond
        bootstrap or a derived one), its
        interpolation, the curves it depends on, and the checks the engine ran against the
        final published set.
      </P>
      <P>
        The checks are the ones the earlier pages rely on: the collapsed lane reconciled
        against trade-by-trade pricing, the risk ladder&apos;s sum compared with a flat
        one-basis-point shift, and the round trip of the daily table back through the curve.
        A check that did not run says so, and the reason on the comparison curves is that
        nothing prices on them. Where a check found a gap it is shown as a flag with its size, because an inventory
        that hides its flags is not worth much.
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
        cross-currency curve needs SOFR first. Nothing in
        the browser prices anything. The pages render what the engine exported.
      </P>
    </>
  ),

  'bond-curve': (
    <>
      <P>
        A government bond quotes a price, and its yield is one number that averages over every
        coupon date. The curve underneath is the set of discount factors{' '}
        <M tex="P(t)" /> that reprices each benchmark bond,
      </P>
      <Eq tex={String.raw`\text{price}_k + \text{accrued}_k = \sum_i c_{k,i}\, \frac{P(t_{k,i})}{P(t_s)},`} />
      <P>
        with <M tex="t_s" /> the settlement date two business days ahead. The curve is solved
        from <N>18</N> benchmark bonds, four bills and one bond near each maturity point out to
        thirty years. It uses the same spline on zero rates as the ESTR curve. The unknowns
        are the zero rates at the <N>18</N> maturities and the conditions are the{' '}
        <N>18</N> prices. They are solved together, because a coupon that falls between two
        pillars is discounted on a stretch of spline that both pillars shape. Each benchmark
        then reprices to within a millionth of a cent.
      </P>
    </>
  ),

  'bond-rv': (
    <>
      <P>
        The government curve is solved from <N>18</N> benchmark bonds. The other{' '}
        <N>33</N> bonds are left off the curve so that they can be measured against
        it. Each has a market yield <M tex="y" />, the single rate that discounts its
        cashflows to its price,
      </P>
      <Eq tex={String.raw`\text{price} + \text{accrued} = \sum_i \frac{c_i}{(1+y)^{\tau_i}},`} />
      <P>
        where <M tex={String.raw`\tau_i`} /> counts coupon periods from settlement on the
        bond&apos;s own day count. The same equation at the curve price gives the curve yield{' '}
        <M tex="y^{*}" />, and the residual is <M tex="r = y - y^{*}" />. A positive residual
        means the bond is cheap. A residual on its own says little, because an old
        high-coupon bond can sit a few basis points cheap for years. The panel therefore
        scores today&apos;s residual against the bond&apos;s own history,
      </P>
      <Eq tex={String.raw`z = \frac{r - \bar r}{\sigma_r},`} />
      <P>
        with the mean and standard deviation taken over <N>250</N> business days, and marks
        the bonds beyond two standard deviations.
      </P>
      <P>
        Two spreads place each bond against the swap market. The z-spread{' '}
        <M tex="s" /> is the constant shift of the ESTR zero curve that reprices the bond,
      </P>
      <Eq tex={String.raw`\text{price} + \text{accrued} = \sum_i c_i\, \frac{P_E(t_i)}{P_E(t_s)}\, e^{-s\,(t_i - t_s)}.`} />
      <P>
        The asset swap spread <M tex="a" /> is the margin over ESTR a holder receives for
        swapping the bond&apos;s coupons at par. It is the bond&apos;s value on the ESTR
        curve less its price, spread over an annuity <M tex="A" /> of annual ACT/360 periods
        to maturity,
      </P>
      <Eq tex={String.raw`a = \frac{\sum_i c_i\, P_E(t_i)/P_E(t_s) - (\text{price} + \text{accrued})}{100\, A}.`} />
      <P>
        The bond universe, the prices and the history are generated for this site. The same
        curve runs on events in stage 03, where a bond price or a change in a bond&apos;s
        terms rebuilds it and the screen is refreshed on every set.
      </P>
    </>
  ),

  'bond-desk': (
    <>
      <P>
        The government curve is one more curve in the engine. It is registered with no parent
        and no child, because it is solved from bond prices alone and only bonds are
        discounted on it. A benchmark bond price therefore rebuilds this curve and no other,
        and a swap quote leaves it where it is. In the recorded session that rebuild takes
        about <N>4.5 ms</N>, and marking all <N>51</N> bonds and the book on the new set
        takes <N>0.6 ms</N>.
      </P>
      <P>
        Bond inputs reach the engine by three routes. The <N>18</N> bonds the curve is solved
        through are quotes on the curve, and a new price starts a rebuild. The other{' '}
        <N>33</N> go to the desk&apos;s price store, where a new price changes that
        bond&apos;s mark and its place on the screen and no curve is rebuilt. The third route
        is the bond&apos;s terms. A term changes rarely, but when it does the curve built
        from it is out of date in the same way as after a price change. A static record is
        therefore an event as well. It is queued, ordered by sequence number and applied by
        the builder thread, and the curve is rebuilt when the bond is one of its instruments.
      </P>
      <Diagram src="/diagrams/bond-events.svg" minWidth={620}
        alt="Flowchart of the bond lane on the event engine. A reference feed and a manual record are reconciled into one record per bond. Prices for the eighteen benchmark bonds and static records for those bonds go through the engine's queue to the builder thread, which rebuilds the government curve and publishes a new set. Prices and records for the other bonds go to the desk's own store. The desk reads the government curve and the ESTR curve from one published set and produces the relative value screen, the book value and attribution, and the risk ladders, with every bond checked against QuantLib."
        caption="The bond lane. A benchmark price or record goes through the engine and rebuilds the curve. Everything else goes to the desk, which marks every bond against one published set." />
      <P>
        A position is valued at its market price. To separate what the curve did from what
        the bond did, each bond carries the constant spread <M tex="s" /> over the government
        curve <M tex="P_G" /> that reprices it. A position of face <M tex="N" /> is worth
      </P>
      <Eq tex={String.raw`V(P_G, s) = \frac{N}{100} \sum_i c_i\, \frac{P_G(t_i)}{P_G(t_s)}\, e^{-s\,(t_i - t_s)},`} />
      <P>
        and its profit since the open splits into two parts with nothing left over. With{' '}
        <M tex="P_G^{0}" /> and <M tex="s_0" /> the curve and the spread at the open,
      </P>
      <Eq tex={String.raw`\Delta V = \underbrace{V(P_G, s_0) - V(P_G^{0}, s_0)}_{\text{curve}} \;+\; \underbrace{V(P_G, s) - V(P_G, s_0)}_{\text{spread}}.`} />
      <P>
        Risk follows the same split. Each pillar of the government curve is moved one basis
        point with every spread held, and the changes in value form the bond ladder. The swap
        hedges have their own ladder on ESTR. The two ladders offset while the two curves
        move together. What is left when they do not is swap spread risk, which is the risk
        the book is there to take.
      </P>
      <P>
        The book is put on at the open by rule. A bond two standard deviations cheap against
        its history is bought and swapped to maturity. A bond that rich is sold against the
        nearest benchmark. An inventory in the benchmark bonds is hedged with four swaps. In
        the first nine sets of the session only rates move, so the bonds stand still and the
        hedges carry all of the profit and loss. The last eight sets are bond prices and
        static records.
      </P>
      <P>
        The desk prices from cashflows flattened once per bond, the way the swap book is
        priced. As a check, the engine also prices every bond through QuantLib on the same
        published curves on every set. Yield, curve price and z-spread agree to within a
        billionth of a basis point across <N>867</N> comparisons, and the export stops if
        they do not. The bonds, their prices and their history are generated.
      </P>
    </>
  ),
  'bond-static-data': (
    <>
      <P>
        A bond&apos;s price changes all day, and its terms change rarely. The coupon, the
        dates and the day count are static data, and a pricing engine takes them on trust. A
        wrong term does not fail. It produces a price that is slightly or badly wrong, and
        the error looks like a market move.
      </P>
      <P>
        A desk has two places to get terms from. A vendor reference feed is broad and arrives
        every day, and it is wrong whenever the vendor is wrong or late. A manually kept
        record is needed for corrections and for lines the feed does not carry, and it picks
        up keying errors. The engine keeps both, compares them field by field, and settles
        each difference by a fixed rule. The result is one record per bond, and the curve and
        the Bond RV panel in stage 01 are built from it.
      </P>
      <P>
        The panel then gives each break a cost. The engine puts the losing value back and
        reprices, so a mistyped coupon shows as a change in that bond&apos;s yield and a wrong
        maturity on a benchmark shows as a move in the whole curve. Some breaks cost nothing,
        and the panel shows those too.
      </P>
      <P>
        The same records reach the live engine as events. In stage 03 the wrong maturity on
        the benchmark arrives during the session. The curve is rebuilt from it, and the bond
        book shows a loss of <N>161,370</N> with no market move behind it. The correction
        arrives on the next set and the loss is gone. The wrong coupon moves its bond&apos;s
        yield by <N>44 bp</N> at an unchanged price, and the screen shows that bond{' '}
        <N>34</N> standard deviations rich until the record is corrected.
      </P>
    </>
  ),

  'pipelines': (
    <>
      <P>
        The engine and the site are separate repositories, and each has its own pipeline. A
        pipeline runs on a push and on a pull request. The engine pipeline builds the
        event-driven engine and runs its three test suites. It
        then runs the static data reconciliation against the terms the prices were
        generated from, and replays a tick session while reader threads check that every
        published curve set is one coherent version. The site
        pipeline lints, type-checks and builds the site, checks the exported data and requests
        each stage from the built pages.
      </P>
      <P>
        A second layer of checks sits in the data export. The export reconciles its own
        results before it writes a file, and a failed gate stops the run. The panel lists both
        layers, and it ends with the parts of the workflow that are still done by hand.
      </P>
    </>
  ),

  'agent-workflow': (
    <>
      <P>
        The engine is built with Claude Code. An agent writes code quickly and is wrong often
        enough to matter, so the useful question is what stops a wrong change. The answer
        used here is separation. One agent writes the tests from the spec before any code
        exists, a second writes the code and cannot touch those tests, and a third reviews
        the result without being able to edit it.
      </P>
      <P>
        The separation is enforced by the tooling. A hook checks each tool call against the
        role of the session that made it, and the runner script checks from git which files
        each stage changed. Between the build and the review sits the pipeline, which has no
        model in it and decides whether the change is correct. A person writes the spec at
        the start and makes the commit at the end.
      </P>
      <P>
        The panel shows the stages, the guards, and the first change taken through the
        workflow, a convexity function for the bond desk.
      </P>
    </>
  ),
};

export default text;
