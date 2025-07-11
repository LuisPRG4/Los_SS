class DashboardAnalitico {
    constructor() {
        this.charts = {};
        this.db = new DB();
        this.initDashboard();
    }

    async initDashboard() {
        try {
            await this.initCharts();
            await this.actualizarDashboard();
            this.iniciarActualizacionAutomatica();
        } catch (error) {
            console.error('Error inicializando dashboard:', error);
            mostrarToast('Error al inicializar el dashboard', 'error');
        }
    }

    async actualizarDashboard() {
        await Promise.all([
            this.actualizarKPIs(),
            this.actualizarGraficos(),
            this.actualizarTablaAnalisis()
        ]);
    }

    async actualizarKPIs() {
        const fechaActual = new Date();
        const primerDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1);
        const ultimoDiaMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 0);

        // Obtener ventas del mes actual
        const ventasMes = await this.calcularVentasPeriodo(primerDiaMes, ultimoDiaMes);
        const ventasMesAnterior = await this.calcularVentasMesAnterior();
        
        // Calcular tendencia
        const tendenciaVentas = ((ventasMes - ventasMesAnterior) / ventasMesAnterior * 100).toFixed(1);
        
        // Actualizar KPI de ventas
        document.getElementById('ventasMes').textContent = `$${ventasMes.toFixed(2)}`;
        document.getElementById('ventasTrend').textContent = `${tendenciaVentas}% vs mes anterior`;
        document.getElementById('ventasTrend').className = `kpi-trend ${tendenciaVentas >= 0 ? 'positive' : 'negative'}`;

        // Calcular eficiencia de cobros
        const { eficiencia, tendencia } = await this.calcularEficienciaCobros();
        document.getElementById('eficienciaCobros').textContent = `${eficiencia}%`;
        document.getElementById('cobrosTrend').textContent = `${tendencia}% vs mes anterior`;
        document.getElementById('cobrosTrend').className = `kpi-trend ${tendencia >= 0 ? 'positive' : 'negative'}`;

        // Obtener producto más vendido
        const productoTop = await this.obtenerProductoMasVendido();
        document.getElementById('productoTop').textContent = productoTop.nombre;
        document.getElementById('productoTopCantidad').textContent = `${productoTop.cantidad} unidades`;

        // Calcular alertas de inventario
        const alertas = await this.calcularAlertasInventario();
        document.getElementById('alertasInventario').textContent = alertas.length;
        document.getElementById('inventarioTrend').textContent = `productos bajos`;
    }

    async calcularVentasPeriodo(fechaInicio, fechaFin) {
        const ventas = await this.db.obtenerVentas();
        return ventas
            .filter(v => new Date(v.fecha) >= fechaInicio && new Date(v.fecha) <= fechaFin)
            .reduce((total, v) => total + v.montoTotal, 0);
    }

    async calcularVentasMesAnterior() {
        const fechaActual = new Date();
        const primerDiaMesAnterior = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1);
        const ultimoDiaMesAnterior = new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 0);
        return await this.calcularVentasPeriodo(primerDiaMesAnterior, ultimoDiaMesAnterior);
    }

    async calcularEficienciaCobros() {
        const ventas = await this.db.obtenerVentas();
        const ventasMes = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            return fechaVenta >= primerDiaMes;
        });

        const totalVentas = ventasMes.reduce((sum, v) => sum + v.montoTotal, 0);
        const totalCobrado = ventasMes.reduce((sum, v) => sum + (v.montoTotal - v.montoPendiente), 0);
        
        const eficiencia = totalVentas > 0 ? (totalCobrado / totalVentas * 100).toFixed(1) : 0;
        
        // Calcular tendencia vs mes anterior
        const ventasMesAnterior = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            const primerDiaMesAnterior = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
            const ultimoDiaMesAnterior = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
            return fechaVenta >= primerDiaMesAnterior && fechaVenta <= ultimoDiaMesAnterior;
        });

        const eficienciaMesAnterior = ventasMesAnterior.length > 0 ? 
            (ventasMesAnterior.reduce((sum, v) => sum + (v.montoTotal - v.montoPendiente), 0) / 
             ventasMesAnterior.reduce((sum, v) => sum + v.montoTotal, 0) * 100) : 0;

        const tendencia = (eficiencia - eficienciaMesAnterior).toFixed(1);

        return { eficiencia, tendencia };
    }

    async obtenerProductoMasVendido() {
        const ventas = await this.db.obtenerVentas();
        const productos = await this.db.obtenerProductos();
        
        // Agrupar ventas por producto
        const ventasPorProducto = {};
        ventas.forEach(venta => {
            if (venta.productos) {
                venta.productos.forEach(prod => {
                    if (!ventasPorProducto[prod.id]) {
                        ventasPorProducto[prod.id] = 0;
                    }
                    ventasPorProducto[prod.id] += prod.cantidad;
                });
            }
        });

        // Encontrar el producto más vendido
        let maxVentas = 0;
        let productoTopId = null;
        
        Object.entries(ventasPorProducto).forEach(([id, cantidad]) => {
            if (cantidad > maxVentas) {
                maxVentas = cantidad;
                productoTopId = id;
            }
        });

        const productoTop = productos.find(p => p.id === productoTopId);
        return {
            nombre: productoTop ? productoTop.nombre : 'No hay datos',
            cantidad: maxVentas
        };
    }

    async calcularAlertasInventario() {
        const productos = await this.db.obtenerProductos();
        return productos.filter(p => p.stock <= p.stockMinimo);
    }

    async initCharts() {
        // Configuración común de Chart.js
        Chart.defaults.color = '#2c3e50';
        Chart.defaults.font.family = "'Montserrat', sans-serif";

        // Inicializar gráficos
        this.charts.ventas = this.initVentasChart();
        this.charts.rentabilidad = this.initRentabilidadChart();
        this.charts.topProductos = this.initTopProductosChart();
        this.charts.proyeccion = this.initProyeccionChart();
    }

    initVentasChart() {
        const ctx = document.getElementById('ventasChart').getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Ventas Diarias',
                    data: [],
                    borderColor: '#2ecc71',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(46, 204, 113, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    initRentabilidadChart() {
        const ctx = document.getElementById('rentabilidadChart').getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Rentabilidad',
                    data: [],
                    backgroundColor: '#3498db'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    initTopProductosChart() {
        const ctx = document.getElementById('topProductosChart').getContext('2d');
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#2ecc71',
                        '#3498db',
                        '#e74c3c',
                        '#f1c40f',
                        '#9b59b6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    initProyeccionChart() {
        const ctx = document.getElementById('proyeccionChart').getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Ventas Reales',
                    data: [],
                    borderColor: '#2ecc71',
                    tension: 0.4
                }, {
                    label: 'Proyección',
                    data: [],
                    borderColor: '#e74c3c',
                    borderDash: [5, 5],
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    async actualizarGraficos() {
        await Promise.all([
            this.actualizarGraficoVentas(),
            this.actualizarGraficoRentabilidad(),
            this.actualizarGraficoTopProductos(),
            this.actualizarGraficoProyeccion()
        ]);
    }

    async actualizarGraficoVentas() {
        const ventas = await this.db.obtenerVentas();
        
        // Agrupar ventas por día
        const ventasPorDia = {};
        ventas.forEach(venta => {
            const fecha = new Date(venta.fecha).toLocaleDateString();
            if (!ventasPorDia[fecha]) {
                ventasPorDia[fecha] = 0;
            }
            ventasPorDia[fecha] += venta.montoTotal;
        });

        // Ordenar por fecha
        const fechasOrdenadas = Object.keys(ventasPorDia).sort((a, b) => new Date(a) - new Date(b));
        const ultimos30Dias = fechasOrdenadas.slice(-30);

        this.charts.ventas.data.labels = ultimos30Dias;
        this.charts.ventas.data.datasets[0].data = ultimos30Dias.map(fecha => ventasPorDia[fecha]);
        this.charts.ventas.update();
    }

    async actualizarGraficoRentabilidad() {
        const ventas = await this.db.obtenerVentas();
        const productos = await this.db.obtenerProductos();

        // Calcular rentabilidad por producto
        const rentabilidadPorProducto = {};
        ventas.forEach(venta => {
            if (venta.productos) {
                venta.productos.forEach(prodVenta => {
                    const producto = productos.find(p => p.id === prodVenta.id);
                    if (producto) {
                        if (!rentabilidadPorProducto[producto.nombre]) {
                            rentabilidadPorProducto[producto.nombre] = 0;
                        }
                        // Rentabilidad = Precio venta - Costo
                        rentabilidadPorProducto[producto.nombre] += 
                            (prodVenta.precio - producto.costo) * prodVenta.cantidad;
                    }
                });
            }
        });

        // Ordenar por rentabilidad
        const productosOrdenados = Object.entries(rentabilidadPorProducto)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        this.charts.rentabilidad.data.labels = productosOrdenados.map(([nombre]) => nombre);
        this.charts.rentabilidad.data.datasets[0].data = productosOrdenados.map(([,rentabilidad]) => rentabilidad);
        this.charts.rentabilidad.update();
    }

    async actualizarGraficoTopProductos() {
        const ventas = await this.db.obtenerVentas();
        const productos = await this.db.obtenerProductos();

        // Calcular cantidad vendida por producto
        const ventasPorProducto = {};
        ventas.forEach(venta => {
            if (venta.productos) {
                venta.productos.forEach(prodVenta => {
                    const producto = productos.find(p => p.id === prodVenta.id);
                    if (producto) {
                        if (!ventasPorProducto[producto.nombre]) {
                            ventasPorProducto[producto.nombre] = 0;
                        }
                        ventasPorProducto[producto.nombre] += prodVenta.cantidad;
                    }
                });
            }
        });

        // Ordenar y tomar top 5
        const top5Productos = Object.entries(ventasPorProducto)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        this.charts.topProductos.data.labels = top5Productos.map(([nombre]) => nombre);
        this.charts.topProductos.data.datasets[0].data = top5Productos.map(([,cantidad]) => cantidad);
        this.charts.topProductos.update();
    }

    async actualizarGraficoProyeccion() {
        const ventas = await this.db.obtenerVentas();
        
        // Agrupar ventas por mes
        const ventasPorMes = {};
        ventas.forEach(venta => {
            const fecha = new Date(venta.fecha);
            const mesKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
            if (!ventasPorMes[mesKey]) {
                ventasPorMes[mesKey] = 0;
            }
            ventasPorMes[mesKey] += venta.montoTotal;
        });

        // Ordenar meses
        const mesesOrdenados = Object.keys(ventasPorMes).sort();
        const ultimos6Meses = mesesOrdenados.slice(-6);

        // Calcular proyección para los próximos 3 meses
        const ventasArray = ultimos6Meses.map(mes => ventasPorMes[mes]);
        const proyeccion = this.calcularProyeccion(ventasArray, 3);

        // Preparar datos para el gráfico
        const labels = [
            ...ultimos6Meses.map(mes => {
                const [year, month] = mes.split('-');
                return new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            }),
            ...Array(3).fill().map((_, i) => {
                const ultimoMes = new Date(mesesOrdenados[mesesOrdenados.length - 1].split('-')[0], 
                                        mesesOrdenados[mesesOrdenados.length - 1].split('-')[1] - 1);
                return new Date(ultimoMes.getFullYear(), ultimoMes.getMonth() + i + 1)
                    .toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            })
        ];

        this.charts.proyeccion.data.labels = labels;
        this.charts.proyeccion.data.datasets[0].data = [...ventasArray, ...Array(3).fill(null)];
        this.charts.proyeccion.data.datasets[1].data = [...Array(6).fill(null), ...proyeccion];
        this.charts.proyeccion.update();
    }

    calcularProyeccion(datos, mesesAProyectar) {
        // Método simple de proyección lineal
        const n = datos.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = datos;

        // Calcular pendiente y punto de intersección
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, i) => a + i * y[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);

        const pendiente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const interseccion = (sumY - pendiente * sumX) / n;

        // Generar proyección
        return Array.from({length: mesesAProyectar}, (_, i) => {
            const proyeccion = pendiente * (n + i) + interseccion;
            return Math.max(0, proyeccion); // Evitar proyecciones negativas
        });
    }

    async actualizarTablaAnalisis() {
        const productos = await this.db.obtenerProductos();
        const ventas = await this.db.obtenerVentas();
        const tbody = document.querySelector('#productosAnalisis tbody');
        tbody.innerHTML = '';

        // Calcular métricas por producto
        productos.forEach(producto => {
            const ventasProducto = this.calcularVentasProducto(producto, ventas);
            const rentabilidad = this.calcularRentabilidadProducto(producto, ventasProducto);
            const tendencia = this.calcularTendenciaProducto(producto, ventas);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${producto.nombre}</td>
                <td>${ventasProducto} unidades</td>
                <td>$${rentabilidad.toFixed(2)}</td>
                <td>${producto.stock} unidades</td>
                <td class="${tendencia >= 0 ? 'positive' : 'negative'}">${tendencia}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    calcularVentasProducto(producto, ventas) {
        return ventas.reduce((total, venta) => {
            const productoEnVenta = venta.productos?.find(p => p.id === producto.id);
            return total + (productoEnVenta?.cantidad || 0);
        }, 0);
    }

    calcularRentabilidadProducto(producto, cantidadVendida) {
        return (producto.precio - producto.costo) * cantidadVendida;
    }

    calcularTendenciaProducto(producto, ventas) {
        const ventasMesActual = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            return fechaVenta >= primerDiaMes;
        }).reduce((total, venta) => {
            const productoEnVenta = venta.productos?.find(p => p.id === producto.id);
            return total + (productoEnVenta?.cantidad || 0);
        }, 0);

        const ventasMesAnterior = ventas.filter(v => {
            const fechaVenta = new Date(v.fecha);
            const primerDiaMesAnterior = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
            const ultimoDiaMesAnterior = new Date(new Date().getFullYear(), new Date().getMonth(), 0);
            return fechaVenta >= primerDiaMesAnterior && fechaVenta <= ultimoDiaMesAnterior;
        }).reduce((total, venta) => {
            const productoEnVenta = venta.productos?.find(p => p.id === producto.id);
            return total + (productoEnVenta?.cantidad || 0);
        }, 0);

        if (ventasMesAnterior === 0) return 0;
        return ((ventasMesActual - ventasMesAnterior) / ventasMesAnterior * 100).toFixed(1);
    }

    iniciarActualizacionAutomatica() {
        // Actualizar cada 5 minutos
        setInterval(() => this.actualizarDashboard(), 5 * 60 * 1000);
    }
}

// Inicializar el dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new DashboardAnalitico();
}); 