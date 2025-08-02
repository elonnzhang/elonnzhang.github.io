# Golang database/sql 数据库连接源码阅读
代码仓库 database/sql

### 打开数据库连接方法

打开数据库连接 sql.Open() 返回 *sql.DB
```
// Open 打开一个由数据库驱动名称和驱动特定的数据源名称指定的数据库，
// 通常至少包括一个数据库名称和连接信息。
//
// 大多数用户会通过一个特定于驱动的连接助手函数来打开数据库，该函数返回一个 [*DB]。
// Go 标准库中不包含数据库驱动。请参见 <https://golang.org/s/sqldrivers> 获取第三方驱动列表。
//
// Open 可能仅验证其参数而不创建数据库连接。要验证数据源名称是否有效，请调用 [DB.Ping]。
//
// 返回的 [DB] 对象是线程安全的，可以被多个 goroutine 并发使用，并维护自己的空闲连接池。
// 因此，Open 函数通常只需调用一次。通常不需要关闭 [DB]。
func Open(driverName, dataSourceName string) (*DB, error) {
	driversMu.RLock()
	driveri, ok := drivers[driverName]
	driversMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("sql: unknown driver %q (forgotten import?)", driverName)
	}

	if driverCtx, ok := driveri.(driver.DriverContext); ok {
		connector, err := driverCtx.OpenConnector(dataSourceName)
		if err != nil {
			return nil, err
		}
		return OpenDB(connector), nil
	}

	return OpenDB(dsnConnector{dsn: dataSourceName, driver: driveri}), nil
}
```

先看一下DB 定义
```
// DB 是一个数据库句柄，表示一个包含零个或多个底层连接的连接池。
// 它是线程安全的，可以被多个 goroutine 并发使用。
//
// sql 包会自动创建和释放连接；它还维护一个空闲连接的池。
// 如果数据库有每个连接状态的概念，这种状态可以在事务 ([Tx]) 或连接 ([Conn]) 中可靠地观察到。
// 一旦调用 [DB.Begin]，返回的 [Tx] 就绑定到一个单一的连接。
// 一旦在事务上调用 [Tx.Commit] 或 [Tx.Rollback]，该事务的连接就会返回到 [DB] 的空闲连接池。
// 可以通过 [DB.SetMaxIdleConns] 控制池的大小。
type DB struct {
	// Total time waited for new connections.
	waitDuration atomic.Int64

	connector driver.Connector
	// numClosed is an atomic counter which represents a total number of
	// closed connections. Stmt.openStmt checks it before cleaning closed
	// connections in Stmt.css.
	numClosed atomic.Uint64

	mu           sync.Mutex    // protects following fields
	freeConn     []*driverConn // free connections ordered by returnedAt oldest to newest
	connRequests map[uint64]chan connRequest
	nextRequest  uint64 // Next key to use in connRequests.
	numOpen      int    // number of opened and pending open connections
	// Used to signal the need for new connections
	// a goroutine running connectionOpener() reads on this chan and
	// maybeOpenNewConnections sends on the chan (one send per needed connection)
	// It is closed during db.Close(). The close tells the connectionOpener
	// goroutine to exit.
	openerCh          chan struct{}
	closed            bool
	dep               map[finalCloser]depSet
	lastPut           map[*driverConn]string // stacktrace of last conn's put; debug only
	maxIdleCount      int                    // zero means defaultMaxIdleConns; negative means 0
	maxOpen           int                    // <= 0 means unlimited
	maxLifetime       time.Duration          // maximum amount of time a connection may be reused
	maxIdleTime       time.Duration          // maximum amount of time a connection may be idle before being closed
	cleanerCh         chan struct{}
	waitCount         int64 // Total number of connections waited for.
	maxIdleClosed     int64 // Total number of connections closed due to idle count.
	maxIdleTimeClosed int64 // Total number of connections closed due to idle time.
	maxLifetimeClosed int64 // Total number of connections closed due to max connection lifetime limit.

	stop func() // stop cancels the connection opener.
}
```

DB 是一个连接池
几个常用的管理参数
```
	maxIdleCount      int                    // zero means defaultMaxIdleConns; negative means 0
	maxOpen           int                    // <= 0 means unlimited
	maxLifetime       time.Duration          // maximum amount of time a connection may be reused
	maxIdleTime       time.Duration          // maximum amount of time a connection may be idle before being closed
```
几个常用方法
```
db.SetConnMaxLifetime     设置一个连接的最长生命周期
db.SetConnMaxIdleTime     设置一个连接的最大空闲时间
db.SetMaxIdleConns        设置连接池里面允许Idel的最大连接数
db.SetMaxOpenConns        设置连接池最大打开的连接数
```



继续往下走
```
// OpenDB 使用 [driver.Connector] 打开一个数据库，允许驱动程序绕过基于字符串的数据源名称。
//
// 大多数用户会通过一个特定于驱动的连接助手函数来打开数据库，该函数返回一个 [*DB]。
// Go 标准库中不包含数据库驱动。请参见 <https://golang.org/s/sqldrivers> 获取第三方驱动列表。
//
// OpenDB 可能仅验证其参数而不创建数据库连接。要验证数据源名称是否有效，请调用 [DB.Ping]。
//
// 返回的 [DB] 对象是线程安全的，可以被多个 goroutine 并发使用，并维护自己的空闲连接池。
// 因此，OpenDB 函数通常只需调用一次。通常不需要关闭 [DB]。
func OpenDB(c driver.Connector) *DB {
	ctx, cancel := context.WithCancel(context.Background())
	db := &DB{
		connector:    c,
		openerCh:     make(chan struct{}, connectionRequestQueueSize),
		lastPut:      make(map[*driverConn]string),
		connRequests: make(map[uint64]chan connRequest),
		stop:         cancel,
	}

	go db.connectionOpener(ctx)

	return db
}
```


Open了之后是直接返回的 return db，异步延迟创建连接 go db.connectionOpener(ctx)。
用sql.Open函数创建连接池，可是此时只是初始化了连接池，并没有创建任何连接。连接创建都是惰性的，只有当你真正使用到连接的时候，连接池才会创建连接。连接池很重要，它直接影响着你的程序行为。连接的创建与关闭有调用决定。
```
// 在一个单独的 goroutine 中运行，当请求时打开新的连接。
func (db *DB) connectionOpener(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-db.openerCh:
			db.openNewConnection(ctx)
		}
	}
}
```


监听 db.openerCh chan 进行 openNewConnection
```
// Open one new connection
func (db *DB) openNewConnection(ctx context.Context) {
    // maybeOpenNewConnections 在发送到 db.openerCh 之前已经执行了 db.numOpen++。
    // 如果连接失败或在返回之前关闭，则此函数必须执行 db.numOpen--。
	ci, err := db.connector.Connect(ctx)
	db.mu.Lock()
	defer db.mu.Unlock()
	if db.closed {
		if err == nil {
			ci.Close()
		}
		db.numOpen--
		return
	}
	if err != nil {
		db.numOpen--
		db.putConnDBLocked(nil, err)
		db.maybeOpenNewConnections()
		return
	}
	dc := &driverConn{
		db:         db,
		createdAt:  nowFunc(),
		returnedAt: nowFunc(),
		ci:         ci,
	}
	if db.putConnDBLocked(dc, err) {
		db.addDepLocked(dc, dc)
	} else {
		db.numOpen--
		ci.Close()
	}
}


openNewConnection 中 ci, err := db.connector.Connect(ctx)  没错误就加锁返回。否则进行 maybeOpenNewConnections  db.openerCh <- struct{}{}

	if err != nil {
		db.numOpen--
		db.putConnDBLocked(nil, err)
		db.maybeOpenNewConnections()
		return
	}


// 假设 db.mu 已被锁定。
// 如果存在连接请求并且尚未达到连接限制，
// 则通知 connectionOpener 打开新连接。
func (db *DB) maybeOpenNewConnections() {
	numRequests := len(db.connRequests)
	if db.maxOpen > 0 {
		numCanOpen := db.maxOpen - db.numOpen
		if numRequests > numCanOpen {
			numRequests = numCanOpen
		}
	}
	for numRequests > 0 {
		db.numOpen++ // optimistically
		numRequests--
		if db.closed {
			return
		}
		db.openerCh <- struct{}{}
	}
}
```

db.openerCh <- struct{}{}  需要新的连接

#### 连接复用策略
```
// connReuseStrategy determines how (*DB).conn returns database connections.
type connReuseStrategy uint8

const (
	// alwaysNewConn 强制创建一个新的数据库连接。
	alwaysNewConn connReuseStrategy = iota
    // cachedOrNewConn 返回一个缓存的连接（如果可用），
    // 否则等待一个连接变得可用（如果已达到 MaxOpenConns），
    // 或者创建一个新的数据库连接。
	cachedOrNewConn
)

// maxBadConnRetries 是在驱动返回 driver.ErrBadConn 表示连接已断开之前，强制打开新连接的最大重试次数。
const maxBadConnRetries = 2

func (db *DB) retry(fn func(strategy connReuseStrategy) error) error {
	for i := int64(0); i < maxBadConnRetries; i++ {
		err := fn(cachedOrNewConn)
		// retry if err is driver.ErrBadConn
		if err == nil || !errors.Is(err, driver.ErrBadConn) {
			return err
		}
	}

	return fn(alwaysNewConn)
}
```
两次缓存测试，失败后创建新的。


#### 数据库连接的操作
```
type Pinger interface {
	Ping(ctx context.Context) error
}
type Execer interface {
	Exec(query string, args []Value) (Result, error)
}
type ExecerContext interface {
	ExecContext(ctx context.Context, query string, args []NamedValue) (Result, error)
}
type Queryer interface {
	Query(query string, args []Value) (Rows, error)
}
type QueryerContext interface {
	QueryContext(ctx context.Context, query string, args []NamedValue) (Rows, error)
}
type ConnBeginTx interface {
	BeginTx(ctx context.Context, opts TxOptions) (Tx, error)
}
```

Ping
```
// Ping verifies a connection to the database is still alive,
// establishing a connection if necessary.
//
// Ping uses [context.Background] internally; to specify the context, use
// [DB.PingContext].
func (db *DB) Ping() error {
	return db.PingContext(context.Background())
}

// PingContext verifies a connection to the database is still alive,
// establishing a connection if necessary.
func (db *DB) PingContext(ctx context.Context) error {
	var dc *driverConn
	var err error

	err = db.retry(func(strategy connReuseStrategy) error {
		dc, err = db.conn(ctx, strategy)
		return err
	})

	if err != nil {
		return err
	}

	return db.pingDC(ctx, dc, dc.releaseConn)
}

// 
func (db *DB) pingDC(ctx context.Context, dc *driverConn, release func(error)) error {
	var err error
	if pinger, ok := dc.ci.(driver.Pinger); ok {
		withLock(dc, func() {
			err = pinger.Ping(ctx)
		})
	}
	release(err)
	return err
}
```

Ping 完成后，release 释放连接  [dc.releaseConn]
```
// driverConn 用一个互斥锁包装 driver.Conn，
// 在对该 Conn 的所有调用期间持有该锁。 (包括对通过该 Conn 返回的接口的任何调用，例如对 Tx、Stmt、Result、Rows 的调用)
type driverConn struct {
	db        *DB
	createdAt time.Time

	sync.Mutex  // guards following
	ci          driver.Conn
  // ···
}

 dc.releaseConn 放回连接池
func (dc *driverConn) releaseConn(err error) {
	dc.db.putConn(dc, err, true)
}
```

上面有段关键代码 KEYCODE
```
err = db.retry(func(strategy connReuseStrategy) error {
		dc, err = db.conn(ctx, strategy)
		return err
	})
```

决定是使用新连接还是缓存连接
```
// conn returns a newly-opened or cached *driverConn.
func (db *DB) conn(ctx context.Context, strategy connReuseStrategy) (*driverConn, error) {
    // 加锁
	db.mu.Lock()
	if db.closed {
		db.mu.Unlock()
		return nil, errDBClosed
	}
	// Check if the context is expired. 上下文是否过期
	select {
	default:
	case <-ctx.Done():
		db.mu.Unlock()
		return nil, ctx.Err()
	}
	lifetime := db.maxLifetime

	// Prefer a free connection, if possible. 优先使用空闲连接:
	last := len(db.freeConn) - 1
	if strategy == cachedOrNewConn && last >= 0 {
		// Reuse the lowest idle time connection so we can close
		// connections which remain idle as soon as possible.
		conn := db.freeConn[last]
		db.freeConn = db.freeConn[:last]
		conn.inUse = true
        // 检查连接是否过期
		if conn.expired(lifetime) {
			db.maxLifetimeClosed++
			db.mu.Unlock()
			conn.Close()
			return nil, driver.ErrBadConn
		}
		db.mu.Unlock()

		// Reset the session if required. 重置会话
		if err := conn.resetSession(ctx); errors.Is(err, driver.ErrBadConn) {
			conn.Close()
			return nil, err
		}

		return conn, nil
	}

	// Out of free connections or we were asked not to use one. If we're not
	// allowed to open any more connections, make a request and wait.
   // 没有空闲连接，创建一个连接请求并等待
	if db.maxOpen > 0 && db.numOpen >= db.maxOpen {
		// Make the connRequest channel. It's buffered so that the
		// connectionOpener doesn't block while waiting for the req to be read.
		req := make(chan connRequest, 1)
		reqKey := db.nextRequestKeyLocked()
		db.connRequests[reqKey] = req // 连接请求
		db.waitCount++
		db.mu.Unlock()

		waitStart := nowFunc()

		// Timeout the connection request with the context.
		select {
		case <-ctx.Done():
			// Remove the connection request and ensure no value has been sent
			// on it after removing.
			db.mu.Lock()
			delete(db.connRequests, reqKey)
			db.mu.Unlock()

			db.waitDuration.Add(int64(time.Since(waitStart)))

			select {
			default:
			case ret, ok := <-req:
				if ok && ret.conn != nil {
					db.putConn(ret.conn, ret.err, false)
				}
			}
			return nil, ctx.Err()
		case ret, ok := <-req:
			db.waitDuration.Add(int64(time.Since(waitStart)))

			if !ok {
				return nil, errDBClosed
			}
			// Only check if the connection is expired if the strategy is cachedOrNewConns.
			// If we require a new connection, just re-use the connection without looking
			// at the expiry time. If it is expired, it will be checked when it is placed
			// back into the connection pool.
			// This prioritizes giving a valid connection to a client over the exact connection
			// lifetime, which could expire exactly after this point anyway.
          // 缓存连接检查
			if strategy == cachedOrNewConn && ret.err == nil && ret.conn.expired(lifetime) {
				db.mu.Lock()
				db.maxLifetimeClosed++
				db.mu.Unlock()
				ret.conn.Close()
				return nil, driver.ErrBadConn
			}
			if ret.conn == nil {
				return nil, ret.err
			}

			// Reset the session if required.
			if err := ret.conn.resetSession(ctx); errors.Is(err, driver.ErrBadConn) {
				ret.conn.Close()
				return nil, err
			}
			return ret.conn, ret.err
		}
	}

	db.numOpen++ // optimistically
	db.mu.Unlock()
    //  创建新连接
	ci, err := db.connector.Connect(ctx)
	if err != nil {
		db.mu.Lock()
		db.numOpen-- // correct for earlier optimism
		db.maybeOpenNewConnections()
		db.mu.Unlock()
		return nil, err
	}
	db.mu.Lock()
	dc := &driverConn{
		db:         db,
		createdAt:  nowFunc(),
		returnedAt: nowFunc(),
		ci:         ci,
		inUse:      true,
	}
	db.addDepLocked(dc, dc)
	db.mu.Unlock()
	return dc, nil
}
```

Exec
```
// Exec executes a query without returning any rows.
// The args are for any placeholder parameters in the query.
//
// Exec uses [context.Background] internally; to specify the context, use
// [DB.ExecContext].
func (db *DB) Exec(query string, args ...any) (Result, error) {
	return db.ExecContext(context.Background(), query, args...)
}

// ExecContext executes a query without returning any rows.
// The args are for any placeholder parameters in the query.
func (db *DB) ExecContext(ctx context.Context, query string, args ...any) (Result, error) {
	var res Result
	var err error

	err = db.retry(func(strategy connReuseStrategy) error {
		res, err = db.exec(ctx, query, args, strategy)
		return err
	})

	return res, err
}

func (db *DB) exec(ctx context.Context, query string, args []any, strategy connReuseStrategy) (Result, error) {
	dc, err := db.conn(ctx, strategy)
	if err != nil {
		return nil, err
	}
	return db.execDC(ctx, dc, dc.releaseConn, query, args)
}

func (db *DB) execDC(ctx context.Context, dc *driverConn, release func(error), query string, args []any) (res Result, err error) {
	defer func() {
		release(err)
	}()
	execerCtx, ok := dc.ci.(driver.ExecerContext)
	var execer driver.Execer
	if !ok {
		execer, ok = dc.ci.(driver.Execer)
	}
	if ok {
		var nvdargs []driver.NamedValue
		var resi driver.Result
		withLock(dc, func() {
			nvdargs, err = driverArgsConnLocked(dc.ci, nil, args)
			if err != nil {
				return
			}
			resi, err = ctxDriverExec(ctx, execerCtx, execer, query, nvdargs)
		})
		if err != driver.ErrSkip {
			if err != nil {
				return nil, err
			}
			return driverResult{dc, resi}, nil
		}
	}

	var si driver.Stmt
	withLock(dc, func() {
		si, err = ctxDriverPrepare(ctx, dc.ci, query)
	})
	if err != nil {
		return nil, err
	}
	ds := &driverStmt{Locker: dc, si: si}
	defer ds.Close()
	return resultFromStatement(ctx, dc.ci, ds, args...)
}
```
Exec 也会放回连接池，return resultFromStatement(ctx, dc.ci, ds, args...) 但是结果集包含了dc.ci 的引用。

Query
```
// Query executes a query that returns rows, typically a SELECT.
//
// Query uses [context.Background] internally; to specify the context, use
// [Tx.QueryContext].
func (tx *Tx) Query(query string, args ...any) (*Rows, error) {
	return tx.QueryContext(context.Background(), query, args...)
}

// QueryContext executes a query that returns rows, typically a SELECT.
func (tx *Tx) QueryContext(ctx context.Context, query string, args ...any) (*Rows, error) {
	dc, release, err := tx.grabConn(ctx)
	if err != nil {
		return nil, err
	}

	return tx.db.queryDC(ctx, tx.ctx, dc, release, query, args)
}

// queryDC executes a query on the given connection.
// The connection gets released by the releaseConn function.
// The ctx context is from a query method and the txctx context is from an
// optional transaction context.
func (db *DB) queryDC(ctx, txctx context.Context, dc *driverConn, releaseConn func(error), query string, args []any) (*Rows, error) {
	queryerCtx, ok := dc.ci.(driver.QueryerContext)
	var queryer driver.Queryer
	if !ok {
		queryer, ok = dc.ci.(driver.Queryer)
	}
	if ok {
		var nvdargs []driver.NamedValue
		var rowsi driver.Rows
		var err error
		withLock(dc, func() {
			nvdargs, err = driverArgsConnLocked(dc.ci, nil, args)
			if err != nil {
				return
			}
			rowsi, err = ctxDriverQuery(ctx, queryerCtx, queryer, query, nvdargs)
		})
		if err != driver.ErrSkip {
			if err != nil {
				releaseConn(err)
				return nil, err
			}
			// Note: ownership of dc passes to the *Rows, to be freed
			// with releaseConn.
			rows := &Rows{
				dc:          dc,
				releaseConn: releaseConn,
				rowsi:       rowsi,
			}
			rows.initContextClose(ctx, txctx)
			return rows, nil
		}
	}

	var si driver.Stmt
	var err error
	withLock(dc, func() {
		si, err = ctxDriverPrepare(ctx, dc.ci, query)
	})
	if err != nil {
		releaseConn(err)
		return nil, err
	}

	ds := &driverStmt{Locker: dc, si: si}
	rowsi, err := rowsiFromStatement(ctx, dc.ci, ds, args...)
	if err != nil {
		ds.Close()
		releaseConn(err)
		return nil, err
	}

	// Note: ownership of ci passes to the *Rows, to be freed
	// with releaseConn.
	rows := &Rows{
		dc:          dc,
		releaseConn: releaseConn,
		rowsi:       rowsi,
		closeStmt:   ds,
	}
	rows.initContextClose(ctx, txctx)
	return rows, nil
}
```

连接释放 关注 release func(error) 由 Rows 调用
```
	// Note: ownership of ci passes to the *Rows, to be freed
	// with releaseConn.
	rows := &Rows{
		dc:          dc,
		releaseConn: releaseConn,
		rowsi:       rowsi,
		closeStmt:   ds,
	}

```
```

// Close closes the [Rows], preventing further enumeration. If [Rows.Next] is called
// and returns false and there are no further result sets,
// the [Rows] are closed automatically and it will suffice to check the
// result of [Rows.Err]. Close is idempotent and does not affect the result of [Rows.Err].
func (rs *Rows) Close() error {
	// If the user's calling Close, they're done with their previous row's Scan
	// results (any RawBytes memory), so we can release the read lock that would
	// be preventing awaitDone from calling the unexported close before we do so.
	rs.closemuRUnlockIfHeldByScan()

	return rs.close(nil)
}

func (rs *Rows) close(err error) error {
   // ... 
  
	rs.releaseConn(err)

	rs.lasterr = rs.lasterrOrErrLocked(err)
	return err
}
```
QueryRow

```
// QueryRow executes a query that is expected to return at most one row.
// QueryRow always returns a non-nil value. Errors are deferred until
// [Row]'s Scan method is called.
// If the query selects no rows, the [*Row.Scan] will return [ErrNoRows].
// Otherwise, [*Row.Scan] scans the first selected row and discards
// the rest.
//
// QueryRow uses [context.Background] internally; to specify the context, use
// [DB.QueryRowContext].
func (db *DB) QueryRow(query string, args ...any) *Row {
	return db.QueryRowContext(context.Background(), query, args...)
}
// QueryRowContext executes a query that is expected to return at most one row.
// QueryRowContext always returns a non-nil value. Errors are deferred until
// [Row]'s Scan method is called.
// If the query selects no rows, the [*Row.Scan] will return [ErrNoRows].
// Otherwise, [*Row.Scan] scans the first selected row and discards
// the rest.
func (db *DB) QueryRowContext(ctx context.Context, query string, args ...any) *Row {
	rows, err := db.QueryContext(ctx, query, args...)
	return &Row{rows: rows, err: err}
}
```

还是调用  QueryContext, 但这里返回的是 Row, Row 在 Scan 后调用 rows.Close
```
// Row is the result of calling [DB.QueryRow] to select a single row.
type Row struct {
	// One of these two will be non-nil:
	err  error // deferred error for easy chaining
	rows *Rows
}

// Scan copies the columns from the matched row into the values
// pointed at by dest. See the documentation on [Rows.Scan] for details.
// If more than one row matches the query,
// Scan uses the first row and discards the rest. If no row matches
// the query, Scan returns [ErrNoRows].
func (r *Row) Scan(dest ...any) error {
  //  ...
	err := r.rows.Scan(dest...)
	if err != nil {
		return err
	}
	// Make sure the query can be processed to completion with no errors.
	return r.rows.Close()
}
```
BeginTx
```
// Begin starts a transaction. The default isolation level is dependent on
// the driver.
//
// Begin uses [context.Background] internally; to specify the context, use
// [DB.BeginTx].
func (db *DB) Begin() (*Tx, error) {
	return db.BeginTx(context.Background(), nil)
}

// BeginTx starts a transaction.
//
// The provided context is used until the transaction is committed or rolled back.
// If the context is canceled, the sql package will roll back
// the transaction. [Tx.Commit] will return an error if the context provided to
// BeginTx is canceled.
//
// The provided [TxOptions] is optional and may be nil if defaults should be used.
// If a non-default isolation level is used that the driver doesn't support,
// an error will be returned.
func (db *DB) BeginTx(ctx context.Context, opts *TxOptions) (*Tx, error) {
	var tx *Tx
	var err error

	err = db.retry(func(strategy connReuseStrategy) error {
		tx, err = db.begin(ctx, opts, strategy)
		return err
	})

	return tx, err
}
func (db *DB) begin(ctx context.Context, opts *TxOptions, strategy connReuseStrategy) (tx *Tx, err error) {
	dc, err := db.conn(ctx, strategy)
	if err != nil {
		return nil, err
	}
	return db.beginDC(ctx, dc, dc.releaseConn, opts)
}

// beginDC starts a transaction. The provided dc must be valid and ready to use.
func (db *DB) beginDC(ctx context.Context, dc *driverConn, release func(error), opts *TxOptions) (tx *Tx, err error) {
	var txi driver.Tx
	keepConnOnRollback := false
	withLock(dc, func() {
		_, hasSessionResetter := dc.ci.(driver.SessionResetter)
		_, hasConnectionValidator := dc.ci.(driver.Validator)
		keepConnOnRollback = hasSessionResetter && hasConnectionValidator
		txi, err = ctxDriverBegin(ctx, opts, dc.ci)
	})
	if err != nil {
		release(err)
		return nil, err
	}

	// Schedule the transaction to rollback when the context is canceled.
	// The cancel function in Tx will be called after done is set to true.
	ctx, cancel := context.WithCancel(ctx)
	tx = &Tx{
		db:                 db,
		dc:                 dc,
		releaseConn:        release,
		txi:                txi,
		cancel:             cancel,
		keepConnOnRollback: keepConnOnRollback,
		ctx:                ctx,
	}
	go tx.awaitDone()
	return tx, nil
}
```

连接释放 关注 release func(error) 交给了Tx Commit / Rollback
```
// close returns the connection to the pool and
// must only be called by Tx.rollback or Tx.Commit while
// tx is already canceled and won't be executed concurrently.
func (tx *Tx) close(err error) {
	tx.releaseConn(err)
	tx.dc = nil
	tx.txi = nil
}
// Commit commits the transaction.
func (tx *Tx) Commit() error {
	
	// ....
	
	tx.close(err)
	return err
}

// Rollback aborts the transaction.
func (tx *Tx) Rollback() error {
	return tx.rollback(false)
}
// rollback aborts the transaction and optionally forces the pool to discard
// the connection.
func (tx *Tx) rollback(discardConn bool) error {
	// ...
	
	tx.close(err)
	return err
}
```


总结

db.Ping() 调用完毕后会马上把连接返回给连接池。

db.Exec() 调用完毕后会马上把连接返回给连接池，但是它返回的Result对象还保留这连接的引用，当后面的代码需要处理结果集的时候连接将会被重用。

db.Query() 调用完毕后会将连接传递给sql.Rows类型，调用.Close()方法后，连接将会被释放回到连接池。

db.QueryRow()调用完毕后会将连接传递给sql.Row类型，当.Scan()方法调用之后把连接释放回到连接池。

db.Begin() 调用完毕后将连接传递给sql.Tx类型对象，当.Commit()或.Rollback()方法调用后释放连接。


