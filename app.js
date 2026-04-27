/* ============================================
   MIP CAFÉ v1.0 — JAVASCRIPT COMPLETO (COM GPS POR PLANTA)
   ============================================ */
window.onerror = function (msg, url, linha, col, erro) {
    alert('ERRO: ' + msg + '\nLinha: ' + linha);
    return false;
};

// === URL DO GOOGLE SHEETS ===
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzM21pcDZbMd_VQMb1d9SudQF7or6YG4msKPKmcE9WxNXQJhn9sqAUk5Y-d9PdbN-ZP/exec';

// === DADOS DAS FAZENDAS E TALHÕES ===
const FAZENDAS_TALHOES = {
    "Ponta da Mata": ["PR04", "PRC", "SR01", "PM02", "AL02", "SZ01"],
    "Aliança": [
        "Catuaí 99",
        "Topázio de Baixo",
        "Topázio da Torre",
        "Mundo Novo",
        "Catuaí 62 Geada",
        "Catuaí 62 2023",
        "Catuaí 62 2025",
        "Arara"
    ]
};

// === ESTADO GLOBAL ===
let avaliacaoAtual = {
    fazenda: '',
    talhao: '',
    variedade: '',
    estadio: '',
    ponto: 'Geral',
    numPlantas: 10,
    plantaAtual: 1,
    dataInicio: null,
    plantas: []
};

// === CAMPOS ===
const CAMPOS_PRAGAS = [
    'brocaViva', 'brocaMorta', 'totalGraos',
    'bmAdulto', 'bmLarva', 'bmOvo', 'folhasMinas', 'totalFolhas',
    'acaroVerm', 'acaroLepr', 'lagarta', 'cochonilha', 'cigarra', 'outraPragaQtd'
];
const CAMPOS_DOENCAS = [
    'ferrugem', 'cercospora', 'phoma', 'antracnose',
    'rizoctonia', 'bacteriose', 'outraDoencaQtd'
];
const CAMPOS_INIMIGOS = [
    'joaninha', 'vespa', 'aranha', 'crisopideo', 'fungosEntomo', 'outroInimigoQtd'
];
const CAMPOS_PLANTA = ['desfolha'];
const TODOS_CAMPOS = [...CAMPOS_PRAGAS, ...CAMPOS_DOENCAS, ...CAMPOS_INIMIGOS, ...CAMPOS_PLANTA];

// ============================================
//   NAVEGAÇÃO
// ============================================
function mostrarTela(id) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById(id).classList.add('ativa');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltarInicio() {
    mostrarTela('telaInicial');
    atualizarContador();
}

function voltarConfig() {
    if (avaliacaoAtual.plantas.length > 0) {
        if (!confirm('Tem dados não finalizados. Deseja voltar?')) return;
    }
    mostrarTela('telaConfig');
}

// ============================================
//   TELA INICIAL
// ============================================
function atualizarContador() {
    const hist = getHistorico();
    const el = document.getElementById('totalAvaliacoes');
    if (hist.length === 0) {
        el.textContent = 'Nenhuma avaliação salva';
    } else {
        el.textContent = `${hist.length} avaliação(ões) salva(s)`;
    }
}

// ============================================
//   FAZENDAS → TALHÕES DINÂMICOS
// ============================================
function atualizarTalhoes() {
    const fazSelect = document.getElementById('fazenda');
    const talSelect = document.getElementById('talhao');
    const fazenda = fazSelect.value;

    talSelect.innerHTML = '';

    if (!fazenda) {
        talSelect.innerHTML = '<option value="">Selecione a fazenda primeiro...</option>';
        talSelect.disabled = true;
        return;
    }

    talSelect.disabled = false;
    talSelect.innerHTML = '<option value="">Selecione o talhão...</option>';

    const talhoes = FAZENDAS_TALHOES[fazenda] || [];
    talhoes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        talSelect.appendChild(opt);
    });
}

// ============================================
//   GEOLOCALIZAÇÃO (GPS)
// ============================================
function obterCoordenadasPlanta() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ lat: "Sem suporte", lng: "Sem suporte" });
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (posicao) => {
                resolve({ 
                    lat: posicao.coords.latitude, 
                    lng: posicao.coords.longitude 
                });
            },
            (erro) => {
                resolve({ lat: "Erro/Negado", lng: "Erro/Negado" });
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } 
        );
    });
}

// ============================================
//   INICIAR AVALIAÇÃO
// ============================================
function toggleOutroAvaliador() {
    const sel = document.getElementById('avaliador');
    const grupo = document.getElementById('outroAvaliadorGroup');
    grupo.style.display = sel.value === 'outros' ? 'block' : 'none';
    if (sel.value !== 'outros') {
        document.getElementById('outroAvaliador').value = '';
    }
}

function getAvaliador() {
    const sel = document.getElementById('avaliador').value;
    if (sel === 'outros') {
        return document.getElementById('outroAvaliador').value.trim() || 'Não informado';
    }
    return sel || 'Não informado';
}

function iniciarAvaliacao() {
    document.getElementById('fazenda').value = '';
    document.getElementById('talhao').innerHTML = '<option value="">Selecione a fazenda primeiro...</option>';
    document.getElementById('talhao').disabled = true;
    document.getElementById('variedade').value = '';
    document.getElementById('estadio').value = '';
    document.getElementById('numPlantas').value = 10;
    mostrarTela('telaConfig');
}

function iniciarColeta() {
    const fazenda = document.getElementById('fazenda').value;
    const talhao = document.getElementById('talhao').value;
    const ponto = 'geral';
    const numPlantas = parseInt(document.getElementById('numPlantas').value);
    const avaliador = getAvaliador();

    if (avaliador === 'Não informado') { toast('⚠️ Selecione o avaliador!'); return; }
    if (!fazenda) { toast('⚠️ Selecione a fazenda!'); return; }
    if (!talhao) { toast('⚠️ Selecione o talhão!'); return; }
    if (!numPlantas || numPlantas < 1) { toast('⚠️ Informe o nº de plantas!'); return; }

    avaliacaoAtual = {
        fazenda, talhao,
        variedade: document.getElementById('variedade').value,
        estadio: document.getElementById('estadio').value,
        ponto, numPlantas,
        plantaAtual: 1,
        dataInicio: new Date().toISOString(),
        plantas: [],
        avaliador: getAvaliador(),
    };

    atualizarTelaColeta();
    mostrarTela('telaColeta');
}

// ============================================
//   TELA COLETA
// ============================================
function atualizarTelaColeta() {
    const pa = avaliacaoAtual.plantaAtual;
    const total = avaliacaoAtual.numPlantas;

    document.getElementById('infoFazendaTalhao').textContent =
        `${avaliacaoAtual.fazenda} › ${avaliacaoAtual.talhao}`;
    document.getElementById('infoPonto').textContent = avaliacaoAtual.ponto;
    document.getElementById('plantaAtualNum').textContent = pa;
    document.getElementById('plantaTotalNum').textContent = total;
    document.getElementById('barraProgresso').style.width = ((pa / total) * 100) + '%';

    limparCamposColeta();
}

function limparCamposColeta() {
    TODOS_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 0;
    });
    ['outraPragaNome', 'outraDoencaNome', 'outroInimigoNome'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const obs = document.getElementById('observacoes');
    if (obs) obs.value = '';
}

// ============================================
//   CONTADORES
// ============================================
function incrementar(id, passo = 1, max = null) {
    const el = document.getElementById(id);
    let val = parseInt(el.value) + passo;
    if (max !== null && val > max) val = max;
    el.value = val;
    vibrar();
}

function decrementar(id) {
    const el = document.getElementById(id);
    const val = parseInt(el.value);
    if (val > 0) { el.value = val - 1; vibrar(); }
}

function vibrar() {
    if (navigator.vibrate) navigator.vibrate(25);
}

// ============================================
//   SEÇÕES EXPANSÍVEIS
// ============================================
function toggleSecao(id) {
    const secao = document.getElementById(id);
    const nomeSeta = id.replace('secao', 'seta');
    const seta = document.getElementById(nomeSeta);

    secao.classList.toggle('aberta');
    if (seta) seta.textContent = secao.classList.contains('aberta') ? '▼' : '▶';
}

// ============================================
//   SALVAR PLANTA (COM GPS)
// ============================================
function coletarDadosPlanta() {
    const dados = {};
    TODOS_CAMPOS.forEach(id => { dados[id] = parseInt(document.getElementById(id).value) || 0; });
    dados.outraPragaNome = document.getElementById('outraPragaNome').value.trim();
    dados.outraDoencaNome = document.getElementById('outraDoencaNome').value.trim();
    dados.outroInimigoNome = document.getElementById('outroInimigoNome').value.trim();
    dados.observacoes = document.getElementById('observacoes').value.trim();
    return dados;
}

function plantaLimpa() {
    const dados = {};
    TODOS_CAMPOS.forEach(id => { dados[id] = 0; });
    dados.outraPragaNome = '';
    dados.outraDoencaNome = '';
    dados.outroInimigoNome = '';
    dados.observacoes = 'Planta limpa';
    dados.limpa = true;
    salvarDadosPlanta(dados);
}

function salvarPlanta() {
    const dados = coletarDadosPlanta();
    dados.limpa = false;
    salvarDadosPlanta(dados);
}

// Transformada em ASYNC para aguardar o GPS
async function salvarDadosPlanta(dados) {
    // Bloqueia os botões para evitar clique duplo
    const botoesAcao = document.querySelectorAll('#telaColeta .botoes-acao button');
    botoesAcao.forEach(b => {
        b.dataset.textoAntigo = b.innerText;
        b.innerText = "📍 GPS...";
        b.disabled = true;
    });

    // Captura as coordenadas
    const coords = await obterCoordenadasPlanta();

    // Atribui ao objeto da planta
    dados.latitude = coords.lat;
    dados.longitude = coords.lng;
    dados.numero = avaliacaoAtual.plantaAtual;
    dados.timestamp = new Date().toISOString();
    
    avaliacaoAtual.plantas.push(dados);
    toast(`✅ Planta ${dados.numero} salva!`);

    // Libera os botões de volta
    botoesAcao.forEach(b => {
        b.innerText = b.dataset.textoAntigo;
        b.disabled = false;
    });

    if (avaliacaoAtual.plantaAtual >= avaliacaoAtual.numPlantas) {
        finalizarAvaliacao();
    } else {
        avaliacaoAtual.plantaAtual++;
        atualizarTelaColeta();
    }
}

// ============================================
//   FINALIZAR
// ============================================
function finalizarAvaliacao() {
    const avaliacao = {
        id: Date.now(),
        fazenda: avaliacaoAtual.fazenda,
        talhao: avaliacaoAtual.talhao,
        variedade: avaliacaoAtual.variedade,
        estadio: avaliacaoAtual.estadio,
        ponto: avaliacaoAtual.ponto,
        numPlantas: avaliacaoAtual.numPlantas,
        dataInicio: avaliacaoAtual.dataInicio,
        dataFim: new Date().toISOString(),
        plantas: avaliacaoAtual.plantas,
        avaliador: avaliacaoAtual.avaliador
    };

    salvarNoHistorico(avaliacao);
    enviarParaGoogleSheets(avaliacao);
    exibirResumo(avaliacao);
    mostrarTela('telaResumo');
}

// ============================================
//   GOOGLE SHEETS — ENVIO
// ============================================
function enviarParaGoogleSheets(avaliacao) {
    const payload = {
        data: formatarData(avaliacao.dataInicio),
        avaliador: avaliacao.avaliador,
        fazenda: avaliacao.fazenda,
        talhao: avaliacao.talhao,
        variedade: avaliacao.variedade,
        estadio: avaliacao.estadio,
        plantas: avaliacao.plantas.map(p => ({
            latitude: p.latitude || 'Sem GPS',    // GPS AQUI AGORA
            longitude: p.longitude || 'Sem GPS',  // GPS AQUI AGORA
            numero: p.numero,
            brocaViva: p.brocaViva || 0,
            brocaMorta: p.brocaMorta || 0,
            totalGraos: p.totalGraos || 0,
            bmAdulto: p.bmAdulto || 0,
            bmLarva: p.bmLarva || 0,
            bmOvo: p.bmOvo || 0,
            folhasMinadas: p.folhasMinas || 0,
            totalFolhas: p.totalFolhas || 0,
            acaroVermelho: p.acaroVerm || 0,
            ferrugem: p.ferrugem || 0,
            cercospora: p.cercospora || 0,
            phoma: p.phoma || 0,
            antracnose: p.antracnose || 0,
            rizoctonia: p.rizoctonia || 0,
            bacteriose: p.bacteriose || 0,
            desfolha: p.desfolha || 0,
            observacoes: p.observacoes || ''
        }))
    };

    fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
    .then(() => {
        toast('☁️ Dados enviados para Google Sheets!');
        marcarComoSincronizado(avaliacao.id);
    })
    .catch(err => {
        console.error('Erro ao enviar:', err);
        toast('⚠️ Sem internet. Dados salvos localmente.');
        marcarComoNaoSincronizado(avaliacao.id);
    });
}

function marcarComoSincronizado(id) {
    const hist = getHistorico();
    const av = hist.find(a => a.id === id);
    if (av) {
        av.sincronizado = true;
        localStorage.setItem('mipCafeHistorico', JSON.stringify(hist));
    }
}

function marcarComoNaoSincronizado(id) {
    const hist = getHistorico();
    const av = hist.find(a => a.id === id);
    if (av) {
        av.sincronizado = false;
        localStorage.setItem('mipCafeHistorico', JSON.stringify(hist));
    }
}

function sincronizarPendentes() {
    const hist = getHistorico();
    const pendentes = hist.filter(a => a.sincronizado === false);
    
    if (pendentes.length === 0) {
        toast('✅ Tudo sincronizado!');
        return;
    }

    toast(`☁️ Sincronizando ${pendentes.length} avaliação(ões)...`);
    
    pendentes.forEach(av => {
        enviarParaGoogleSheets(av);
    });
}

// ============================================
//   RESUMO
// ============================================
function exibirResumo(av) {
    const n = av.plantas.length;
    const soma = (c) => av.plantas.reduce((s, p) => s + (p[c] || 0), 0);
    const media = (c) => (soma(c) / n).toFixed(1);
    const incidencia = (c) => {
        const count = av.plantas.filter(p => (p[c] || 0) > 0).length;
        return ((count / n) * 100).toFixed(0);
    };

    const totalGraos = soma('totalGraos');
    const totalBrocaViva = soma('brocaViva');
    const totalBrocaMorta = soma('brocaMorta');
    const pctBrocaViva = totalGraos > 0 ? ((totalBrocaViva / totalGraos) * 100).toFixed(1) : '0.0';
    const pctBrocaMorta = totalGraos > 0 ? ((totalBrocaMorta / totalGraos) * 100).toFixed(1) : '0.0';
    const pctBrocaTotal = totalGraos > 0 ? (((totalBrocaViva + totalBrocaMorta) / totalGraos) * 100).toFixed(1) : '0.0';

    const totalFolhas = soma('totalFolhas');
    const totalFolhasMinas = soma('folhasMinas');
    const pctBM = totalFolhas > 0 ? ((totalFolhasMinas / totalFolhas) * 100).toFixed(1) : '0.0';

    const plantasLimpas = av.plantas.filter(p => p.limpa).length;
    const dataFormatada = formatarData(av.dataInicio);

    // Pegar o GPS da primeira planta como referência para o resumo
    let gpsStatus = 'Não capturado';
    if (av.plantas.length > 0 && typeof av.plantas[0].latitude === 'number') {
        gpsStatus = `${av.plantas[0].latitude.toFixed(5)}, ${av.plantas[0].longitude.toFixed(5)} (1ª Planta)`;
    } else if (av.plantas.length > 0 && av.plantas[0].latitude) {
        gpsStatus = av.plantas[0].latitude;
    }

    const syncStatus = av.sincronizado === true ? '☁️ Sincronizado' : 
                       av.sincronizado === false ? '⚠️ Pendente' : '';

    let h = '';

    h += `<div class="resumo-card"><h3>📋 Informações Gerais</h3>`;
    h += ri('Data', dataFormatada);
    h += ri('Avaliador', av.avaliador || '—');
    h += ri('Fazenda', av.fazenda);
    h += ri('Talhão', av.talhao);
    h += ri('Variedade', av.variedade || '—');
    h += ri('Estádio', av.estadio || '—');
    h += ri('📍 GPS Ref.', gpsStatus); 
    h += ri('Plantas avaliadas', n);
    h += ri('Plantas limpas', `${plantasLimpas} (${((plantasLimpas/n)*100).toFixed(0)}%)`, 'ok');
    if (syncStatus) h += ri('Nuvem', syncStatus);
    h += `</div>`;

    h += `<div class="resumo-card"><h3>🐛 Broca-do-café</h3>`;
    h += ri('Grãos amostrados', totalGraos);
    h += ri('Broqueados (viva)', totalBrocaViva);
    h += ri('C/ broca morta', totalBrocaMorta);
    h += ri('% Broca viva', pctBrocaViva + '%', parseFloat(pctBrocaViva) > 3 ? 'alerta' : 'ok');
    h += ri('% Broca morta', pctBrocaMorta + '%');
    h += ri('% Infestação total', pctBrocaTotal + '%', parseFloat(pctBrocaTotal) > 5 ? 'alerta' : 'ok');
    h += `</div>`;

    h += `<div class="resumo-card"><h3>🐛 Bicho-mineiro</h3>`;
    h += ri('Adultos (média/planta)', media('bmAdulto'));
    h += ri('Minas/larvas (média)', media('bmLarva'));
    h += ri('Ovos (média)', media('bmOvo'));
    h += ri('Folhas avaliadas', totalFolhas);
    h += ri('Folhas com minas', totalFolhasMinas);
    h += ri('% Folhas minadas', pctBM + '%', parseFloat(pctBM) > 20 ? 'alerta' : 'ok');
    h += ri('Incidência (plantas c/ BM)', incidencia('bmLarva') + '%');
    h += `</div>`;

    h += `<div class="resumo-card"><h3>🐛 Outras Pragas</h3>`;
    h += ri('Ácaro vermelho (média)', media('acaroVerm'));
    h += ri('Ácaro da leprose (média)', media('acaroLepr'));
    h += ri('Lagarta (média)', media('lagarta'));
    h += ri('Cochonilha (média)', media('cochonilha'));
    h += ri('Cigarras (média)', media('cigarra'));
    const pragaC = av.plantas.find(p => p.outraPragaNome);
    if (pragaC) h += ri(pragaC.outraPragaNome + ' (média)', media('outraPragaQtd'));
    h += `</div>`;

    h += `<div class="resumo-card"><h3>🍂 Doenças (Média Notas 0 a 5)</h3>`;
    h += ri('Ferrugem', media('ferrugem'), parseFloat(media('ferrugem')) > 1 ? 'alerta' : 'ok');
    h += ri('Cercospora', media('cercospora'));
    h += ri('Phoma', media('phoma'));
    h += ri('Antracnose', media('antracnose'));
    h += ri('Rizoctonia', media('rizoctonia'));
    h += ri('Bacteriose', media('bacteriose'));
    const doencaC = av.plantas.find(p => p.outraDoencaNome);
    if (doencaC) h += ri(doencaC.outraDoencaNome, media('outraDoencaQtd'));
    h += `<div style="margin-top: 10px; border-top: 1px dashed #ccc; padding-top: 10px;"></div>`;
    h += ri('Desfolha da planta', media('desfolha'));
    h += `</div>`;

    h += `<div class="resumo-card"><h3>🐞 Inimigos Naturais (total)</h3>`;
    h += ri('Joaninha', soma('joaninha'), 'ok');
    h += ri('Vespa predadora', soma('vespa'), 'ok');
    h += ri('Aranha', soma('aranha'), 'ok');
    h += ri('Crisopídeo', soma('crisopideo'), 'ok');
    h += ri('Fungos entomopatogênicos', soma('fungosEntomo'), 'ok');
    const inimC = av.plantas.find(p => p.outroInimigoNome);
    if (inimC) h += ri(inimC.outroInimigoNome, soma('outroInimigoQtd'), 'ok');
    h += `</div>`;

    document.getElementById('resumoConteudo').innerHTML = h;
}

function ri(rotulo, valor, cls) {
    const clsStr = cls ? ` ${cls}` : '';
    return `<div class="resumo-item"><span class="rotulo">${rotulo}</span><span class="valor${clsStr}">${valor}</span></div>`;
}

// ============================================
//   HISTÓRICO (localStorage)
// ============================================
function getHistorico() {
    try { return JSON.parse(localStorage.getItem('mipCafeHistorico')) || []; }
    catch { return []; }
}

function salvarNoHistorico(avaliacao) {
    const hist = getHistorico();
    hist.push(avaliacao);
    localStorage.setItem('mipCafeHistorico', JSON.stringify(hist));
}

function abrirHistorico() {
    const hist = getHistorico();
    const el = document.getElementById('listaHistorico');

    if (hist.length === 0) {
        el.innerHTML = '<div class="hist-vazio">📭 Nenhuma avaliação salva ainda</div>';
    } else {
        let html = '';
        hist.slice().reverse().forEach((av, i) => {
            const idx = hist.length - 1 - i;
            const syncIcon = av.sincronizado === true ? '☁️' : 
                           av.sincronizado === false ? '⚠️' : '📱';
            html += `
                <div class="hist-card" onclick="verDetalheHistorico(${idx})">
                    <div class="hist-card-header">
                        <h4>${syncIcon} ${av.fazenda} — ${av.talhao}</h4>
                        <span class="data">${formatarData(av.dataInicio)}</span>
                    </div>
                    <div class="hist-card-info">
                        👤 ${av.avaliador || '—'} · 🌱 ${av.numPlantas} plantas · ${av.variedade || '—'}
                    </div>
                </div>`;
        });
        el.innerHTML = html;
    }
    mostrarTela('telaHistorico');
}

function verDetalheHistorico(idx) {
    const hist = getHistorico();
    if (hist[idx]) {
        exibirResumo(hist[idx]);
        mostrarTela('telaResumo');
    }
}

function limparHistorico() {
    if (confirm('⚠️ Apagar TODO o histórico?\nEssa ação não pode ser desfeita!')) {
        if (confirm('🗑 Confirma exclusão?')) {
            localStorage.removeItem('mipCafeHistorico');
            toast('🗑 Histórico apagado');
            voltarInicio();
        }
    }
}

// ============================================
//   EXPORTAÇÃO CSV
// ============================================
function exportarCSV() {
    const hist = getHistorico();
    if (hist.length === 0) { toast('Nenhum dado para exportar'); return; }
    const av = hist[hist.length - 1];
    baixarCSV(gerarCSVUnico(av), `MIP_${av.fazenda}_${av.talhao}.csv`);
}

function exportarTudo() {
    const hist = getHistorico();
    if (hist.length === 0) { toast('Nenhum dado para exportar'); return; }

    let csv = 'Avaliador;Fazenda;Talhão;Variedade;Estádio;Latitude;Longitude;Planta;Data;';
    csv += 'Broca Viva;Broca Morta;Total Grãos;';
    csv += 'BM Adulto;BM Larva;BM Ovo;Folhas Minas;Total Folhas;';
    csv += 'Ácaro Verm;Ácaro Lepr;Lagarta;Cochonilha;Cigarra;Outra Praga;Outra Praga Qtd;';
    csv += 'Ferrugem;Cercospora;Phoma;Antracnose;Rizoctonia;Bacteriose;Outra Doença;Outra Doença Qtd;Desfolha;';
    csv += 'Joaninha;Vespa;Aranha;Crisopídeo;Fungos;Outro Inimigo;Outro Inimigo Qtd;';
    csv += 'Observações;Planta Limpa\n';

    hist.forEach(av => {
        av.plantas.forEach(p => {
            csv += `${av.avaliador||''};${av.fazenda};${av.talhao};${av.variedade};${av.estadio};${p.latitude||''};${p.longitude||''};${p.numero};${formatarData(p.timestamp)};`;
            csv += `${p.brocaViva};${p.brocaMorta};${p.totalGraos};`;
            csv += `${p.bmAdulto};${p.bmLarva};${p.bmOvo};${p.folhasMinas};${p.totalFolhas};`;
            csv += `${p.acaroVerm};${p.acaroLepr};${p.lagarta};${p.cochonilha||0};${p.cigarra||0};${p.outraPragaNome||''};${p.outraPragaQtd};`;
            csv += `${p.ferrugem};${p.cercospora};${p.phoma};${p.antracnose};${p.rizoctonia};${p.bacteriose};${p.outraDoencaNome||''};${p.outraDoencaQtd};${p.desfolha||0};`;
            csv += `${p.joaninha};${p.vespa};${p.aranha};${p.crisopideo};${p.fungosEntomo};${p.outroInimigoNome||''};${p.outroInimigoQtd};`;
            csv += `${(p.observacoes||'').replace(/;/g,',')};${p.limpa?'Sim':'Não'}\n`;
        });
    });

    baixarCSV(csv, `MIP_Cafe_Completo_${formatarDataArquivo()}.csv`);
}

function gerarCSVUnico(av) {
    let csv = 'Latitude;Longitude;Planta;Broca Viva;Broca Morta;Total Grãos;';
    csv += 'BM Adulto;BM Larva;BM Ovo;Folhas Minas;Total Folhas;';
    csv += 'Ácaro Verm;Ácaro Lepr;Lagarta;Cochonilha;Cigarra;';
    csv += 'Ferrugem;Cercospora;Phoma;Antracnose;Rizoctonia;Bacteriose;Desfolha;';
    csv += 'Joaninha;Vespa;Aranha;Crisopídeo;Fungos;Obs;Limpa\n';

    av.plantas.forEach(p => {
        csv += `${p.latitude||''};${p.longitude||''};${p.numero};${p.brocaViva};${p.brocaMorta};${p.totalGraos};`;
        csv += `${p.bmAdulto};${p.bmLarva};${p.bmOvo};${p.folhasMinas};${p.totalFolhas};`;
        csv += `${p.acaroVerm};${p.acaroLepr};${p.lagarta};${p.cochonilha||0};${p.cigarra||0};`;
        csv += `${p.ferrugem};${p.cercospora};${p.phoma};${p.antracnose};${p.rizoctonia};${p.bacteriose};${p.desfolha||0};`;
        csv += `${p.joaninha};${p.vespa};${p.aranha};${p.crisopideo};${p.fungosEntomo};`;
        csv += `${(p.observacoes||'').replace(/;/g,',')};${p.limpa?'Sim':'Não'}\n`;
    });
    return csv;
}

function baixarCSV(csv, nome) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nome;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('📤 CSV exportado!');
}

// ============================================
//   WHATSAPP
// ============================================
function compartilharWhatsApp() {
    const hist = getHistorico();
    if (hist.length === 0) return;
    const av = hist[hist.length - 1];

    const n = av.plantas.length;
    const soma = (c) => av.plantas.reduce((s, p) => s + (p[c] || 0), 0);
    const media = (c) => (soma(c) / n).toFixed(1);
    const incidencia = (c) => {
        const ct = av.plantas.filter(p => (p[c] || 0) > 0).length;
        return ((ct / n) * 100).toFixed(0);
    };

    const tG = soma('totalGraos');
    const pctB = tG > 0 ? ((soma('brocaViva') / tG) * 100).toFixed(1) : '0.0';
    const tF = soma('totalFolhas');
    const pctBM = tF > 0 ? ((soma('folhasMinas') / tF) * 100).toFixed(1) : '0.0';
    const limpas = av.plantas.filter(p => p.limpa).length;

    const latRef = av.plantas[0] ? av.plantas[0].latitude : 'Sem GPS';
    const lngRef = av.plantas[0] ? av.plantas[0].longitude : '';

    let m = `☕ *MIP CAFÉ — Relatório*\n`;
    m += `📅 ${formatarData(av.dataInicio)}\n`;
    m += `👤 *Avaliador:* ${av.avaliador || '—'}\n`;
    m += `🏡 *${av.fazenda}* — *${av.talhao}*\n`;
    m += `🌱 ${av.variedade || '—'} · ${av.estadio || '—'}\n`;
    m += `📍 *GPS (Ref. 1ª Planta):* ${latRef}, ${lngRef}\n`;
    m += `🌱 ${n} plantas avaliadas (GPS individual na planilha)\n`;
    m += `✅ Limpas: ${limpas} (${((limpas/n)*100).toFixed(0)}%)\n\n`;
    m += `*🐛 BROCA:* ${pctB}% (viva)\n`;
    m += `*🐛 BICHO-MINEIRO:* ${pctBM}% folhas\n`;
    m += `Minas média: ${media('bmLarva')}/planta\n\n`;
    m += `*🍂 DOENÇAS (Nota média):*\n`;
    m += `Ferrugem: ${media('ferrugem')}\n`;
    m += `Cercospora: ${media('cercospora')}\n`;
    m += `Desfolha: ${media('desfolha')}\n\n`;
    m += `*🐞 INIMIGOS NATURAIS:*\n`;
    m += `Joaninha: ${soma('joaninha')} · Vespa: ${soma('vespa')} · Aranha: ${soma('aranha')}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(m)}`, '_blank');
}

// ============================================
//   UTILITÁRIOS
// ============================================
function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarDataArquivo() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

function toast(msg) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 2500);
}

// ============================================
//   INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    atualizarContador();
});

