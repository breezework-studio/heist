/* Heist — translations (EN / PT) and event narration */
(function (root) {
'use strict';
const L = {
en: {
  title: 'Heist', subtitle: 'Escape the city before it locks down',
  newGame: 'New game', continue: 'Continue', rules: 'Rules', language: 'Language', players: 'Players', human: 'Human', computer: 'Computer', off: 'Off',
  start: 'Start the heist', setupTitle: 'Set up the game', mode: 'Mode', modeBase: 'Base game', modePowers: 'Player Powers', modeMissions: 'Missions',
  powerPick: 'Power assignment', pickFree: 'Free choice', pickRandom: 'Random', pickColor: 'By colour', upgradeGas: 'Upgrade Pack: Gas Can card', upgradeFix: 'Upgrade Pack: 3 extra Fixers',
  easyCosta: 'Easy Lt. Costa (takes 1 tile)', both: 'Powers + Missions (not recommended)', speed: 'Animation speed', slow: 'Slow', normal: 'Normal', fast: 'Fast',
  seatHint: 'Choose who plays each colour. 1 human = solo game vs Lt. Costa; 2 = with Inspector Sandra.',
  day: 'Day', parts: ['Morning', 'Afternoon', 'Evening', 'Night', 'Dawn'],
  phases: { income: 'Income', patrol: 'Patrol', city: 'City', order: 'Turn order' },
  yourTurn: 'Your turn', waiting: 'is thinking…', money: 'Money', income: 'Income', notoriety: 'Notoriety', wounds: 'Wounds',
  rest: 'Rest', move: 'Move', escape: 'Escape the city!', pass: 'Pass', done: 'Done', confirm: 'Confirm', cancel: 'Cancel', yes: 'Yes', no: 'No', skip: 'Skip', none: 'None',
  chooseDest: 'Tap a highlighted location to move there', restHint: 'Rest: refresh cards & equipment, unlock 1 asset (once per day)',
  abilities: 'Abilities', useAbility: 'Use', avoidTitle: 'Avoid the police', avoidHint: 'Officers on the tiles you left. Use your gear or take a Wound for each one left.',
  takeWounds: 'Take the wounds', acceptWounds: n => `Accept ${n} wound${n === 1 ? '' : 's'}`, noOfficers: 'No officers to avoid.',
  placeTitle: 'Place a city tile', placeHint: 'Pick a tile, then a glowing space. Use ⟳ to rotate.', rotate: 'Rotate',
  chooseBiz: 'Business placed here', chooseSh: 'Safe House placed here',
  contactTitle: 'Take a Contact card', optB: 'Keep it', optC: 'Replace one of mine (+1 notoriety)', optA: 'Discard it', pickCard: 'Pick a card from the display',
  unlockTitle: 'Unlock an Asset tile', unlockHint: 'Choose a locked asset to move to your unlocked row.',
  policeTitle: 'Move a police officer', policeHint: (n) => `${n} crossed a notoriety line. Move one officer at least one tile closer to them.`,
  policeSelf: 'You crossed a notoriety line. On behalf of the Inspector/Lieutenant move an officer one tile closer to you.',
  pickOfficer: 'Pick an officer, then its destination', endTitle: 'End of turn', endHint: 'Use more abilities or end your turn.', endTurn: 'End turn',
  q: {
    incomeUnlock: 'Pay $3k to unlock an Asset tile?', useDisc: 'Use an Extra Action disc to play now?', gas: 'Take a Gas Can (+1 movement later)?', unlock: 'Unlock an Asset tile?',
    church: 'Pay $1k to lose 1 notoriety?', bonus_biz: 'Business group complete! Choose a bonus', bonus_sh: 'All Safe Houses visited! Choose a bonus', hospital: 'Heal wounds?',
    key: 'Take a key', fixer: 'Buy a Fixer?', equip: 'Buy equipment?', locker: 'Open a locker?', exit: 'At the exit', lockerPick: 'Choose a locker tile to keep', exitPick: 'Choose an exit tile to keep',
    clawsExtra: 'Claws: draw extra tiles ($2k each)?', mrv: 'Mr. V at the Safe House', mission: 'Mission complete! Choose your ability', ladyRefresh: 'Lady T.: refresh this Fixer?', swapOrder: 'Swap turn order with the player ahead?'
  },
  mrvOpt: { lose: 'Lose 1 notoriety (normal)', none: "Don't lose notoriety (take a wound)", gain: 'Gain 1 notoriety (take a wound)' },
  power: 'Power', mission: 'Mission', secret: 'secret', missionDone: 'Mission complete', tokenOn: 'available today', tokenOff: 'used today', keepFaceUp: 'Pay $2k to keep cards face up',
  nbTitle: 'Notoriety this round', nbCancel: 'gains and losses cancel out', nbLine: n => n > 1 ? `crosses ${n} lines` : 'crosses a line', nbWound: n => `+${n} wound${n > 1 ? 's' : ''} (top of track)`, nbFloor: 'cannot go below 1', nbFull: 'all 4 cubes used',
  nbHelp: 'You have 4 notoriety cubes. Each gain moves a cube from the middle to the red box (▲), each loss to the blue box (▼). Your marker only moves after everyone has acted: up 1 per red cube, down 1 per blue cube. If all 4 cubes are already placed, a gain takes a cube back from the blue box and a loss takes one back from the red box — so you never go beyond +4 or −4 in one round. Example: +2 then −2 leaves 2 red and 2 blue (no change); one more gain then returns a blue cube, for a net +1.',
  showBoard: 'Show full player board', left: n => `${n} left in the pile`, leftT: 'Tiles left', leftHelp: 'How many tiles are still in the supply / pile.', thTitle: n => `Notoriety line ${n}`, chip: { cards: 'Contact cards', equip: 'Equipment & Fixers', bags: 'Money bags (lockers & exits)', keys: 'Keys', cuffs: 'Handcuffs' },
  chipHelp: { cards: 'How many Contact cards they hold (count for lockers, exit tiles and the end score).', equip: 'Equipment and Fixer tiles in their item spaces.', bags: 'Locker and Exit tiles — their values are secret.', keys: 'Keys taken from Safe Houses, by colour. Open lockers of that colour or a closed Business.', cuffs: 'Handcuffs block Contact spaces and cost a card at the end.' },
  stepTravel: 'travel', stepAvoid: 'avoid', stepAny: 'any time',
  lockerLegend: 'Back of each locker: open it if notoriety + Contact cards ≥ the number; you draw tiles = your cards ± the value shown. You need a key of that colour.',
  lockerHelp: (min, draw) => `Needs notoriety + Contact cards ≥ ${min} and a key of this colour. Draw ${draw === '+1' ? 'cards + 1' : draw === '-1' ? 'cards − 1' : 'as many as your cards'} tiles and keep one.`,
  incomeNow: 'income now', endMoney: 'end of game', noKeys: 'no keys left',
  bizLegend: n => `Each business closes after ${n} visits (squares). After that you can still enter with a key. Each player visits a business only once.`,
  shLegend: 'Safe Houses never close and have no visit limit; each player visits each one once. Keys left shown on the right.',
  incHelp: 'Players whose Escape Plan shows $ for this place: they received income right away.', endHelp: 'Players whose Escape Plan shows money here: they score it at the end of the game (secret value).',
  turnOrder: 'Turn order', thGain: ['line 1: unlock 1 asset · lower players move police toward you', 'line 2: unlock 2 assets · lower players move police toward you', 'line 3: unlock 1 asset + Extra Action · lower players move police toward you'],
  modeBoth: 'Both', extraN: n => n ? `Draw ${n} extra ($${2 * n}k)` : 'No extra tiles', choosePower: 'Power for each player', randomPower: 'Random',
  opt: { disc: 'Extra Action disc', unlock: 'Unlock an asset', unlockBiz: 'Unlock an asset & lose 1 notoriety', unlockSh: 'Unlock an asset & gain income', income: 'Receive income', tile: 'Take an Exit tile', heal: n => n ? `Heal ${n} ($${[0, 1, 3, 6][n]}k)` : 'No healing' },
  cards: 'Contacts', items: 'Items', assets: 'Unlocked assets', locked: 'locked', keys: 'Keys', gang: 'Gang', discs: 'Extra actions', gas: 'Gas',
  market: 'City', log: 'Log', me: 'Me', opponents: 'Rivals', hidden: 'hidden', plan: 'Escape plan', patrols: 'Exits',
  open: 'open', closed: 'closed', business: 'Business', businesses: 'Businesses', safehouses: 'Safe Houses', fixers: 'Fixers', equipment: 'Equipment', lockers: 'Lockers', display: 'Contact display',
  gameOver: 'Game over', winner: 'Winner', winners: 'Winners', arrested: 'Arrested', escaped: 'Escaped', playAgain: 'Play again', total: 'Total',
  score: { g1: 'Purple businesses', g2: 'Blue businesses', sh: 'Safe Houses', cash: 'Cash', assets: 'Used assets', contacts: 'Contact cards', bags: 'Locker & exit bags', notor: 'Notoriety', wounds: 'Wounds' },
  replay: 'Replay last turn', menu: 'Menu', help: 'Help', search: 'Search the rules…', close: 'Close', noResults: 'Nothing found. Try other words.',
  tapHelp: 'Tip: long-press or hover anything to see what it does.', confirmQuit: 'Abandon this game and go to the menu?',
  you: 'You', bot: 'Bot', mp: 'MP', police: 'police', cost: 'cost', free: 'free', variant: { walk: 'Walk', jetski: 'Jet Ski', sewer: 'Sewer', chopper: 'Chopper card', heliFixer: 'Helicopter', gangHeli: 'Gang biker', gangCardHeli: 'Gang card', motorcycleHeli: 'Motorcycle', medevac: 'Medevac' },
  extraMp: n => `+${n} gas`, escapeHere: 'Leave the city from here',
  types: { county: 'County', federal: 'Federal', swat: 'SWAT', sandra: 'Inspector Sandra', costa: 'Lt. Costa' },
  colors: { orange: 'Orange', purple: 'Purple', pink: 'Pink', yellow: 'Yellow', green: 'Green' },
  costaScore: 'Lt. Costa', npcSandra: 'Inspector Sandra', npcCosta: 'Lt. Costa', beatCosta: 'You beat Lt. Costa!', lostCosta: 'Lt. Costa wins this time.',
},
pt: {
  title: 'Heist', subtitle: 'Foge da cidade antes que a fechem',
  newGame: 'Novo jogo', continue: 'Continuar', rules: 'Regras', language: 'Língua', players: 'Jogadores', human: 'Humano', computer: 'Computador', off: 'Fora',
  start: 'Começar o golpe', setupTitle: 'Preparar o jogo', mode: 'Modo', modeBase: 'Jogo base', modePowers: 'Poderes', modeMissions: 'Missões',
  powerPick: 'Atribuição de poderes', pickFree: 'Escolha livre', pickRandom: 'Sorteio', pickColor: 'Por cor', upgradeGas: 'Upgrade Pack: carta Gas Can', upgradeFix: 'Upgrade Pack: 3 Fixers extra',
  easyCosta: 'Tenente Costa fácil (tira 1 peça)', both: 'Poderes + Missões (não recomendado)', speed: 'Velocidade das animações', slow: 'Lenta', normal: 'Normal', fast: 'Rápida',
  seatHint: 'Escolhe quem joga cada cor. 1 humano = modo solo contra o Tenente Costa; 2 = com a Inspetora Sandra.',
  day: 'Dia', parts: ['Manhã', 'Tarde', 'Fim de tarde', 'Noite', 'Madrugada'],
  phases: { income: 'Rendimento', patrol: 'Patrulha', city: 'Cidade', order: 'Ordem de turno' },
  yourTurn: 'A tua vez', waiting: 'está a pensar…', money: 'Dinheiro', income: 'Rendimento', notoriety: 'Notoriedade', wounds: 'Ferimentos',
  rest: 'Descansar', move: 'Mover', escape: 'Fugir da cidade!', pass: 'Passar', done: 'Feito', confirm: 'Confirmar', cancel: 'Cancelar', yes: 'Sim', no: 'Não', skip: 'Saltar', none: 'Nenhum',
  chooseDest: 'Toca num local destacado para ires para lá', restHint: 'Descansar: recupera cartas e equipamento, desbloqueia 1 ativo (1 vez por dia)',
  abilities: 'Habilidades', useAbility: 'Usar', avoidTitle: 'Evitar a polícia', avoidHint: 'Polícias nas peças que deixaste. Usa o teu material ou leva um ferimento por cada um que sobrar.',
  takeWounds: 'Levar os ferimentos', acceptWounds: n => `Aceitar ${n} ferimento${n === 1 ? '' : 's'}`, noOfficers: 'Não há polícias a evitar.',
  placeTitle: 'Colocar uma peça de cidade', placeHint: 'Escolhe uma peça e depois um espaço a brilhar. Usa ⟳ para rodar.', rotate: 'Rodar',
  chooseBiz: 'Business colocado aqui', chooseSh: 'Casa Segura colocada aqui',
  contactTitle: 'Tirar uma carta de Contacto', optB: 'Ficar com ela', optC: 'Substituir uma minha (+1 notoriedade)', optA: 'Descartar', pickCard: 'Escolhe uma carta da mostra',
  unlockTitle: 'Desbloquear um ativo', unlockHint: 'Escolhe um ativo bloqueado para passar para a fila desbloqueada.',
  policeTitle: 'Mover um polícia', policeHint: (n) => `${n} passou uma linha de notoriedade. Move um polícia pelo menos uma peça mais perto.`,
  policeSelf: 'Passaste uma linha de notoriedade. Em nome da Inspetora/Tenente, move um polícia uma peça mais perto de ti.',
  pickOfficer: 'Escolhe um polícia e depois o destino', endTitle: 'Fim do turno', endHint: 'Usa mais habilidades ou termina o turno.', endTurn: 'Terminar turno',
  q: {
    incomeUnlock: 'Pagar $3k para desbloquear um ativo?', useDisc: 'Usar um disco de Ação Extra para jogar agora?', gas: 'Levar uma Lata de Gasolina (+1 movimento depois)?', unlock: 'Desbloquear um ativo?',
    church: 'Pagar $1k para perder 1 de notoriedade?', bonus_biz: 'Grupo de Business completo! Escolhe um bónus', bonus_sh: 'Todas as Casas Seguras visitadas! Escolhe um bónus', hospital: 'Curar ferimentos?',
    key: 'Tirar uma chave', fixer: 'Comprar um Fixer?', equip: 'Comprar equipamento?', locker: 'Abrir um cacifo?', exit: 'Na saída', lockerPick: 'Escolhe a peça de cacifo a guardar', exitPick: 'Escolhe a peça de saída a guardar',
    clawsExtra: 'Claws: tirar peças extra ($2k cada)?', mrv: 'Mr. V na Casa Segura', mission: 'Missão cumprida! Escolhe a tua habilidade', ladyRefresh: 'Lady T.: recuperar este Fixer?', swapOrder: 'Trocar de lugar na ordem de turno com o jogador à tua frente?'
  },
  mrvOpt: { lose: 'Perder 1 de notoriedade (normal)', none: 'Não perder notoriedade (levas um ferimento)', gain: 'Ganhar 1 de notoriedade (levas um ferimento)' },
  power: 'Poder', mission: 'Missão', secret: 'secreta', missionDone: 'Missão cumprida', tokenOn: 'disponível hoje', tokenOff: 'usado hoje', keepFaceUp: 'Pagar $2k para manter as cartas viradas para cima',
  nbTitle: 'Notoriedade desta ronda', nbCancel: 'ganhos e perdas anulam-se', nbLine: n => n > 1 ? `passa ${n} linhas` : 'passa uma linha', nbWound: n => `+${n} ferimento${n > 1 ? 's' : ''} (topo da escala)`, nbFloor: 'não desce abaixo de 1', nbFull: 'os 4 cubos estão em uso',
  nbHelp: 'Tens 4 cubos de notoriedade. Cada ganho passa um cubo do meio para a caixa vermelha (▲), cada perda para a caixa azul (▼). O marcador só se mexe depois de todos jogarem: sobe 1 por cada cubo vermelho e desce 1 por cada azul. Se os 4 cubos já estiverem colocados, um ganho devolve um cubo da caixa azul e uma perda devolve um da vermelha — por isso nunca passas de +4 ou −4 numa ronda. Exemplo: +2 e depois −2 deixa 2 vermelhos e 2 azuis (fica igual); mais um ganho devolve um azul, ficando +1.',
  showBoard: 'Ver o tabuleiro completo', left: n => `restam ${n} na pilha`, leftT: 'Peças restantes', leftHelp: 'Quantas peças ainda restam na reserva / pilha.', thTitle: n => `Linha de notoriedade ${n}`, chip: { cards: 'Cartas de Contacto', equip: 'Equipamento e Fixers', bags: 'Sacos de dinheiro (cacifos e saídas)', keys: 'Chaves', cuffs: 'Algemas' },
  chipHelp: { cards: 'Quantas cartas de Contacto tem (contam para os cacifos, peças de saída e pontuação final).', equip: 'Equipamento e Fixers nos espaços de item.', bags: 'Peças de cacifo e de saída — os valores são secretos.', keys: 'Chaves tiradas das Casas Seguras, por cor. Abrem cacifos dessa cor ou um Business fechado.', cuffs: 'As algemas bloqueiam espaços de Contacto e custam uma carta no fim.' },
  stepTravel: 'viagem', stepAvoid: 'evitar', stepAny: 'qualquer',
  lockerLegend: 'Verso de cada cacifo: abre-se se notoriedade + cartas de Contacto ≥ número; tiras peças = as tuas cartas ± o valor indicado. Precisas de uma chave dessa cor.',
  lockerHelp: (min, draw) => `Precisa de notoriedade + cartas de Contacto ≥ ${min} e de uma chave desta cor. Tiras ${draw === '+1' ? 'cartas + 1' : draw === '-1' ? 'cartas − 1' : 'tantas peças como cartas'} peças e guardas uma.`,
  incomeNow: 'rendimento já', endMoney: 'fim do jogo', noKeys: 'sem chaves',
  bizLegend: n => `Cada Business fecha ao fim de ${n} visitas (quadrados). Depois disso ainda se pode entrar com uma chave. Cada jogador só visita cada Business uma vez.`,
  shLegend: 'As Casas Seguras nunca fecham e não têm limite de visitas; cada jogador visita cada uma uma vez. À direita, as chaves que ainda lá estão.',
  incHelp: 'Jogadores cujo Plano de Fuga mostra $ neste local: receberam rendimento logo.', endHelp: 'Jogadores cujo Plano de Fuga mostra dinheiro aqui: pontuam no fim do jogo (valor secreto).',
  turnOrder: 'Ordem de turno', thGain: ['linha 1: desbloqueias 1 ativo · quem tem menos notoriedade move polícia para perto de ti', 'linha 2: desbloqueias 2 ativos · quem tem menos notoriedade move polícia para perto de ti', 'linha 3: desbloqueias 1 ativo + Ação Extra · quem tem menos notoriedade move polícia para perto de ti'],
  modeBoth: 'Ambos', extraN: n => n ? `Tirar ${n} extra ($${2 * n}k)` : 'Sem peças extra', choosePower: 'Poder de cada jogador', randomPower: 'Aleatório',
  opt: { disc: 'Disco de Ação Extra', unlock: 'Desbloquear ativo', unlockBiz: 'Desbloquear ativo e perder 1 de notoriedade', unlockSh: 'Desbloquear ativo e receber rendimento', income: 'Receber rendimento', tile: 'Tirar peça de saída', heal: n => n ? `Curar ${n} ($${[0, 1, 3, 6][n]}k)` : 'Não curar' },
  cards: 'Contactos', items: 'Itens', assets: 'Ativos desbloqueados', locked: 'bloqueado', keys: 'Chaves', gang: 'Gang', discs: 'Ações extra', gas: 'Gasolina',
  market: 'Cidade', log: 'Histórico', me: 'Eu', opponents: 'Rivais', hidden: 'escondido', plan: 'Plano de fuga', patrols: 'Saídas',
  open: 'aberta', closed: 'fechada', business: 'Business', businesses: 'Businesses', safehouses: 'Casas Seguras', fixers: 'Fixers', equipment: 'Equipamento', lockers: 'Cacifos', display: 'Mostra de Contactos',
  gameOver: 'Fim do jogo', winner: 'Vencedor', winners: 'Vencedores', arrested: 'Preso', escaped: 'Fugiu', playAgain: 'Jogar outra vez', total: 'Total',
  score: { g1: 'Business roxos', g2: 'Business azuis', sh: 'Casas Seguras', cash: 'Dinheiro', assets: 'Ativos usados', contacts: 'Cartas de Contacto', bags: 'Sacos de cacifos e saídas', notor: 'Notoriedade', wounds: 'Ferimentos' },
  replay: 'Rever último turno', menu: 'Menu', help: 'Ajuda', search: 'Pesquisar nas regras…', close: 'Fechar', noResults: 'Não encontrei nada. Tenta outras palavras.',
  tapHelp: 'Dica: mantém o dedo (ou o rato) sobre qualquer coisa para ver o que faz.', confirmQuit: 'Abandonar este jogo e voltar ao menu?',
  you: 'Tu', bot: 'Bot', mp: 'mov.', police: 'polícias', cost: 'custo', free: 'grátis', variant: { walk: 'A pé', jetski: 'Jet Ski', sewer: 'Esgoto', chopper: 'Carta Chopper', heliFixer: 'Helicóptero', gangHeli: 'Motard do gang', gangCardHeli: 'Carta Gang', motorcycleHeli: 'Mota', medevac: 'Medevac' },
  extraMp: n => `+${n} gasolina`, escapeHere: 'Sair da cidade por aqui',
  types: { county: 'County', federal: 'Federal', swat: 'SWAT', sandra: 'Inspetora Sandra', costa: 'Tenente Costa' },
  colors: { orange: 'Laranja', purple: 'Roxo', pink: 'Rosa', yellow: 'Amarelo', green: 'Verde' },
  costaScore: 'Tenente Costa', npcSandra: 'Inspetora Sandra', npcCosta: 'Tenente Costa', beatCosta: 'Venceste o Tenente Costa!', lostCosta: 'Desta vez ganhou o Tenente Costa.',
}};

const NAMES = {
  en: { casino: 'Casino', bar: 'Bar', restaurant: 'Restaurant', gym: 'Gym', nightclub: 'Nightclub', gallery: 'Art Gallery', sh1: 'Safe House 1', sh2: 'Safe House 2', sh3: 'Safe House 3',
    storeA: 'Store A', storeB: 'Store B', storeC: 'Store C', storeD: 'Store D', exit1: 'Exit 1', exit2: 'Exit 2', exit3: 'Exit 3', hospital: 'Hospital', clinic: 'Clinic', church: 'Church',
    subway: 'Subway', heliport: 'Heliport', gang: 'Gang HQ',
    helmet: 'Helmet', vest: 'Vest', hat: 'Hat', gasmask: 'Gas Mask',
    move_county: 'Move County officer', move_federal: 'Move Federal officer', move_swat: 'Move SWAT officer', avoid_tile: 'Avoid all police on a tile', master_key: 'Master key', heal: 'Heal 1 wound', extra_action: 'Extra Action',
    telephone: 'Telephone', safe: 'Safe', disguise: 'Disguise', idcard: 'ID Card', firstaid: 'First Aid Kit', motorcycle: 'Motorcycle', energy: 'Energy Drink', helicopter: 'Helicopter', scuba: 'Scuba', skater: 'Skater', gold: 'Gold Bars',
    green: 'green', black: 'black', brown: 'brown' },
  pt: { casino: 'Casino', bar: 'Bar', restaurant: 'Restaurante', gym: 'Ginásio', nightclub: 'Discoteca', gallery: 'Galeria de Arte', sh1: 'Casa Segura 1', sh2: 'Casa Segura 2', sh3: 'Casa Segura 3',
    storeA: 'Loja A', storeB: 'Loja B', storeC: 'Loja C', storeD: 'Loja D', exit1: 'Saída 1', exit2: 'Saída 2', exit3: 'Saída 3', hospital: 'Hospital', clinic: 'Clínica', church: 'Igreja',
    subway: 'Metro', heliport: 'Heliporto', gang: 'Sede do Gang',
    helmet: 'Capacete', vest: 'Colete', hat: 'Boné', gasmask: 'Máscara de gás',
    move_county: 'Mover polícia County', move_federal: 'Mover polícia Federal', move_swat: 'Mover polícia SWAT', avoid_tile: 'Evitar toda a polícia de uma peça', master_key: 'Chave mestra', heal: 'Curar 1 ferimento', extra_action: 'Ação Extra',
    telephone: 'Telefone', safe: 'Cofre', disguise: 'Disfarce', idcard: 'Cartão de Identidade', firstaid: 'Kit de Primeiros Socorros', motorcycle: 'Mota', energy: 'Bebida Energética', helicopter: 'Helicóptero', scuba: 'Mergulho', skater: 'Skater', gold: 'Barras de Ouro',
    green: 'verde', black: 'preto', brown: 'castanho' }
};
const EFFECT = {
  en: { sewer: 'Move to a tile 2 away through the sewers, ignoring police in between', jetski: 'Cross water freely this turn', lose_notoriety: 'Lose 1 notoriety', heal: 'Heal 1 wound', move_police: t => `Move a ${t} officer to any tile without one`, refresh: 'Flip back all your used cards & equipment', chopper: 'Fly from a helipad tile to a place 1–2 tiles away (1 MP)', gang_ability: 'Use one gang ability (lose 1 notoriety / fly from helipad / ignore police on a tile)', avoid_types: t => `Avoid all ${t} officers on one tile`, take_contact: 'Take a Contact card', unlock_asset: 'Unlock an Asset tile', extra_action: 'Take an Extra Action disc', remove_police: t => `Remove a ${t} officer from the game`, avoid_one_any: 'Avoid 1 officer of any type', medevac: 'Fly straight to the Hospital (ends movement)', gain_income: 'Receive income', avoid_all_tile: 'Avoid all police on one tile', plus_mp: '+1 movement point', master_key: 'Visit a closed Business or open any locker' },
  pt: { sewer: 'Ir pelos esgotos para uma peça a 2 de distância, ignorando a polícia pelo meio', jetski: 'Atravessar água livremente neste turno', lose_notoriety: 'Perder 1 de notoriedade', heal: 'Curar 1 ferimento', move_police: t => `Mover um polícia ${t} para outra peça sem nenhum`, refresh: 'Virar de volta todas as cartas e equipamento usados', chopper: 'Voar de uma peça com heliporto para um sítio a 1–2 peças (1 mov.)', gang_ability: 'Usar uma habilidade de gang (perder 1 notoriedade / voar de heliporto / ignorar a polícia de uma peça)', avoid_types: t => `Evitar todos os polícias ${t} de uma peça`, take_contact: 'Tirar uma carta de Contacto', unlock_asset: 'Desbloquear um ativo', extra_action: 'Ganhar um disco de Ação Extra', remove_police: t => `Retirar um polícia ${t} do jogo`, avoid_one_any: 'Evitar 1 polícia de qualquer tipo', medevac: 'Voar direto para o Hospital (termina o movimento)', gain_income: 'Receber rendimento', avoid_all_tile: 'Evitar toda a polícia de uma peça', plus_mp: '+1 ponto de movimento', master_key: 'Visitar um Business fechado ou abrir qualquer cacifo' }
};

const POWER_PT = {
  bones: 'Começas com 1 lata de gasolina. Todas as peças contam como tendo helipad. Só tens 2 pontos de movimento por turno.',
  ruby: 'Podes entrar num Business fechado sem chave. Ganhas 2 de notoriedade de cada vez.',
  vinnie: 'Podes abrir cacifos sem chave. Ganhas 1 de notoriedade sempre que tiras uma peça de cacifo.',
  claws: 'Quando tiras peças de saída ou de cacifo, podes tirar 1 ou 2 extra para escolher, pagando $2k por cada.',
  scar: 'No passo de evitar, podes pagar $2k e descartar uma lata de gasolina para evitar 1 polícia de qualquer tipo.',
  shadow: 'Podes empilhar até 2 peças de cacifo ou de saída no mesmo espaço de item. Não podes substituir peças.',
  dasilva: 'Sempre que recebes rendimento, ganhas mais $3k. Todos os custos aumentam $1k.',
  ladyt: 'Podes recuperar Fixers como se fossem equipamento. De cada vez pagas $1k mais o custo do Fixer.',
  mrv: 'Numa Casa Segura, em vez de perder 1 de notoriedade, podes ganhar 1 ou não perder nenhuma. Se o fizeres, levas um ferimento.',
  kitty: 'Começas a controlar o gang da peça inicial e com menos $3k. Não podes contratar gangs.'
};
const MISSION_PT = {
  1: { goals: ['Controlar 2 gangs', 'Ter 3 cartas sem nenhum Bribe nem Snitch'], abilities: ['Podes atravessar água.', '1 vez por dia, podes usar um helipad como se tivesses um helicóptero.', '1 vez por dia, evita 1 polícia Federal.'] },
  2: { goals: ['Receber rendimento de 2 Businesses', 'Ter 1 peça de cacifo e 1 peça de saída'], abilities: ['Recebes mais $5k na fase de rendimento.', '1 vez por dia, no teu turno, podes tirar 1 carta de Contacto.', '1 vez por dia, evita 1 polícia SWAT.'] },
  3: { goals: ['Visitar todos os Business do mesmo grupo', 'Ter 3 cartas sem estrela de notoriedade'], abilities: ['1 vez por dia, usa uma carta de Contacto sem pagar (automático na primeira).', 'Ao usar uma carta de Contacto, paga mais $2k para não a virar.', '1 vez por dia, move 1 polícia SWAT.'] },
  4: { goals: ['Gastar 2 Ações Extra no mesmo dia', 'Ter 3 cartas com estrela de notoriedade'], abilities: ['Ignora a presença de outros jogadores nas Casas Seguras.', 'Troca a tua posição na ordem de turno com o jogador à tua frente (1 vez por dia).', '1 vez por dia, evita 1 polícia County.'] },
  5: { goals: ['Visitar 2 Casas Seguras', 'Ter notoriedade 7'], abilities: ['Todas as peças contam como tendo helipad.', 'Controlas gangs de graça.', '1 vez por dia, move 1 polícia Federal.'] },
  6: { goals: ['Ter 5 ativos desbloqueados', 'Ter 3 equipamentos virados para cima'], abilities: ['Os ativos desbloqueados com escudo podem evitar 1 polícia de qualquer tipo.', '1 vez por dia, ignora um ganho de 1 de notoriedade (automático).', '1 vez por dia, move 1 polícia County.'] }
};
const CAP = {
  en: { sewer: 'Sewer: jump 2 tiles', jetski: 'Cross water', lose_notoriety: '−1 notoriety', heal: 'Heal 1 wound', move_police: 'Move {t}', refresh: 'Refresh all', chopper: 'Fly 1–2 tiles', gang_ability: 'Gang ability', avoid_types: 'Avoid {t} on 1 tile', take_contact: '+1 Contact', unlock_asset: 'Unlock 1 asset', extra_action: '+1 Extra Action', remove_police: 'Remove {t}', avoid_one_any: 'Avoid 1 officer', medevac: 'Fly to Hospital', gain_income: 'Get income', avoid_all_tile: 'Avoid all on 1 tile', plus_mp: '+1 movement' },
  pt: { sewer: 'Esgoto: saltar 2 peças', jetski: 'Atravessar água', lose_notoriety: '−1 notoriedade', heal: 'Curar 1 ferimento', move_police: 'Mover {t}', refresh: 'Recuperar tudo', chopper: 'Voar 1–2 peças', gang_ability: 'Habilidade de gang', avoid_types: 'Evitar {t} numa peça', take_contact: '+1 Contacto', unlock_asset: 'Desbloquear 1 ativo', extra_action: '+1 Ação Extra', remove_police: 'Retirar {t}', avoid_one_any: 'Evitar 1 polícia', medevac: 'Voar p/ Hospital', gain_income: 'Receber rendimento', avoid_all_tile: 'Evitar todos numa peça', plus_mp: '+1 movimento' }
};
const I = { lang: 'en' };
I.cap = (eff, type, types) => { const c = CAP[I.lang][eff] || eff; const tt = types ? types.map(x => I.t('types.' + x)).join(' + ') : type ? I.t('types.' + type) : ''; return c.replace('{t}', tt); };
I.powerText = (pw) => I.lang === 'pt' ? POWER_PT[pw.id] : pw.text;
I.missionText = (m) => I.lang === 'pt' ? MISSION_PT[m.id] : m;
I.set = (l) => { I.lang = l === 'pt' ? 'pt' : 'en'; };
I.t = (k, ...a) => { let v = k.split('.').reduce((o, x) => o && o[x], L[I.lang]); if (v == null) v = k.split('.').reduce((o, x) => o && o[x], L.en); return typeof v === 'function' ? v(...a) : (v == null ? k : v); };
I.name = (k) => NAMES[I.lang][k] || NAMES.en[k] || k;
I.effect = (eff, types) => { const f = EFFECT[I.lang][eff]; if (!f) return eff; if (typeof f === 'function') { const tt = (types || []).map(x => I.t('types.' + x)).join(I.lang === 'pt' ? ' e ' : ' & '); return f(tt); } return f; };

// narrate an engine event -> string (or null to skip)
I.narrate = function (e, ctx) {
  const pt = I.lang === 'pt'; const N = (id) => ctx.pname(id); const loc = (id) => ctx.locName(id);
  const sign = (d) => (d > 0 ? '+' : '−') + '$' + Math.abs(d) + 'k';
  switch (e.t) {
    case 'day': return pt ? `☀ Dia ${e.day} começa` : `☀ Day ${e.day} begins`;
    case 'phase': return `— ${I.t('phases.' + e.ph)} —`;
    case 'part': return `🕑 ${I.t('parts')[e.part]}`;
    case 'patrol': return pt ? `🚓 Patrulha na Saída ${e.exit}${e.count === 2 ? ' — fechada!' : ''}` : `🚓 Patrol at Exit ${e.exit}${e.count === 2 ? ' — closed!' : ''}`;
    case 'exitClosed': return null;
    case 'place': return pt ? `${N(e.p)} coloca uma peça de cidade` : `${N(e.p)} places a city tile`;
    case 'display': return pt ? 'Novas peças de cidade reveladas' : 'New city tiles revealed';
    case 'order': return (pt ? 'Ordem: ' : 'Order: ') + e.order.map(N).join(' → ');
    case 'turn': return pt ? `▶ Vez de ${N(e.p)}` : `▶ ${N(e.p)}'s turn`;
    case 'move': return pt ? `${N(e.p)} vai para ${loc(e.to)}${e.mp ? ` (${e.mp} mov.)` : ''}` : `${N(e.p)} moves to ${loc(e.to)}${e.mp ? ` (${e.mp} MP)` : ''}`;
    case 'rest': return pt ? `${N(e.p)} descansa e recupera o material` : `${N(e.p)} rests and refreshes`;
    case 'pass': return pt ? `${N(e.p)} não tem jogada e passa` : `${N(e.p)} has no legal move and passes`;
    case 'money': return `${N(e.p)} ${sign(e.d)}${ctx.why(e.why)}`;
    case 'notor': return pt ? `${N(e.p)} ${e.d > 0 ? '+' : '−'}${Math.abs(e.d)} notoriedade${ctx.why(e.why)}` : `${N(e.p)} ${e.d > 0 ? '+' : '−'}${Math.abs(e.d)} notoriety${ctx.why(e.why)}`;
    case 'level': return pt ? `${N(e.p)}: notoriedade ${e.from} → ${e.to}` : `${N(e.p)}: notoriety ${e.from} → ${e.to}`;
    case 'threshold': return pt ? `⚠ ${N(e.p)} passa a linha ${e.n} de notoriedade!` : `⚠ ${N(e.p)} crosses notoriety line ${e.n}!`;
    case 'wound': return pt ? `🩸 ${N(e.p)} leva um ferimento${ctx.why(e.why)}` : `🩸 ${N(e.p)} takes a wound${ctx.why(e.why)}`;
    case 'cuffs': return pt ? `⛓ ${N(e.p)} leva umas algemas!` : `⛓ ${N(e.p)} gets handcuffed!`;
    case 'heal': return pt ? `✚ ${N(e.p)} cura ${e.n} ferimento${e.n > 1 ? 's' : ''}` : `✚ ${N(e.p)} heals ${e.n} wound${e.n > 1 ? 's' : ''}`;
    case 'police': return pt ? `👮 ${N(e.p)} move um polícia ${I.t('types.' + e.type)}` : `👮 ${N(e.p)} moves a ${I.t('types.' + e.type)} officer`;
    case 'policeRemove': return pt ? `👮 ${N(e.p)} tira um polícia ${I.t('types.' + e.type)} do jogo` : `👮 ${N(e.p)} removes a ${I.t('types.' + e.type)} officer`;
    case 'npcMoved': return pt ? `${N(e.p)} afasta ${N(e.npc)}` : `${N(e.p)} sends ${N(e.npc)} away`;
    case 'avoided': return pt ? `🛡 ${N(e.p)} evita a polícia` : `🛡 ${N(e.p)} avoids the police`;
    case 'avoidDone': return e.wounds ? null : null;
    case 'bribe': return pt ? `${N(e.p)} suborna o Tenente Costa ($3k)` : `${N(e.p)} bribes Lt. Costa ($3k)`;
    case 'visit': return pt ? `${N(e.p)} visita ${loc(e.loc)}` : `${N(e.p)} visits ${loc(e.loc)}`;
    case 'cantVisit': return pt ? `${N(e.p)} não consegue visitar ${loc(e.loc)}` : `${N(e.p)} can't visit ${loc(e.loc)}`;
    case 'cube': return pt ? `${N(e.p)} recupera o dinheiro em ${I.name(e.at)}${e.income ? ' (rendimento imediato)' : ''}` : `${N(e.p)} recovers the money at ${I.name(e.at)}${e.income ? ' (instant income)' : ''}`;
    case 'closed': return pt ? `🔒 ${I.name(e.biz)} fecha` : `🔒 ${I.name(e.biz)} closes`;
    case 'contact': return pt ? `🃏 ${N(e.p)} fica com o Contacto ${ctx.card(e.card)}` : `🃏 ${N(e.p)} takes the ${ctx.card(e.card)} contact`;
    case 'contactDiscard': return pt ? `🃏 ${N(e.p)} descarta ${ctx.card(e.card)}` : `🃏 ${N(e.p)} discards ${ctx.card(e.card)}`;
    case 'npcContact': return pt ? `🃏 ${N(e.p)} fica com ${ctx.card(e.card)}` : `🃏 ${N(e.p)} pockets ${ctx.card(e.card)}`;
    case 'cdraw': return null;
    case 'useContact': return pt ? `${N(e.p)} usa ${ctx.card(e.card)}` : `${N(e.p)} uses ${ctx.card(e.card)}`;
    case 'useFixer': return pt ? `${N(e.p)} usa o Fixer ${I.name(e.id)}` : `${N(e.p)} uses the ${I.name(e.id)} Fixer`;
    case 'useEquip': return pt ? `${N(e.p)} usa ${I.name(e.id)}` : `${N(e.p)} uses the ${I.name(e.id)}`;
    case 'useAsset': return pt ? `${N(e.p)} usa o ativo ${I.name(e.id)}` : `${N(e.p)} uses asset: ${I.name(e.id)}`;
    case 'useGang': return pt ? `🏍 ${N(e.p)} chama um motard do gang` : `🏍 ${N(e.p)} calls a gang biker`;
    case 'gangFree': return pt ? `O gang fica livre outra vez` : `The gang is free again`;
    case 'gangHire': return pt ? `🏍 ${N(e.p)} contrata o gang ($5k)` : `🏍 ${N(e.p)} hires the gang ($5k)`;
    case 'firstAid': return pt ? `${N(e.p)} usa os primeiros socorros` : `${N(e.p)} uses first aid`;
    case 'unlock': return pt ? `🔓 ${N(e.p)} desbloqueia: ${I.name(e.id)}` : `🔓 ${N(e.p)} unlocks: ${I.name(e.id)}`;
    case 'unlockLost': return pt ? `${N(e.p)} perde o ativo ${I.name(e.id)} (sem espaço)` : `${N(e.p)} loses ${I.name(e.id)} (no room)`;
    case 'key': return pt ? `🔑 ${N(e.p)} fica com uma chave ${I.name(e.color)}` : `🔑 ${N(e.p)} takes a ${I.name(e.color)} key`;
    case 'keyUse': return pt ? `🔑 ${N(e.p)} usa uma chave ${I.name(e.color)}` : `🔑 ${N(e.p)} uses a ${I.name(e.color)} key`;
    case 'gas': return pt ? `⛽ ${N(e.p)} leva uma lata de gasolina` : `⛽ ${N(e.p)} takes a gas can`;
    case 'gasUse': return pt ? `⛽ ${N(e.p)} gasta gasolina (+1 mov.)` : `⛽ ${N(e.p)} burns gas (+1 MP)`;
    case 'item': return e.item.kind === 'locker' || e.item.kind === 'exit' ? (pt ? `💰 ${N(e.p)} guarda um saco de dinheiro` : `💰 ${N(e.p)} stashes a money bag`) : (pt ? `${N(e.p)} compra ${I.name(e.item.id)}` : `${N(e.p)} buys ${I.name(e.item.id)}`);
    case 'itemLost': return pt ? `${N(e.p)} deixa um item para trás` : `${N(e.p)} leaves an item behind`;
    case 'locker': return pt ? `🗄 ${N(e.p)} abre um cacifo ${I.name(e.color)}` : `🗄 ${N(e.p)} opens a ${I.name(e.color)} locker`;
    case 'exitTile': return null;
    case 'refresh': return pt ? `${N(e.p)} recupera todo o material` : `${N(e.p)} refreshes everything`;
    case 'disc': return pt ? `${N(e.p)} usa uma Ação Extra` : `${N(e.p)} spends an Extra Action`;
    case 'discGain': return pt ? `${N(e.p)} ganha uma Ação Extra` : `${N(e.p)} gains an Extra Action`;
    case 'restBack': return null;
    case 'escape': return pt ? `🚗💨 ${N(e.p)} FOGE da cidade! (${e.order}.º, paga $${e.cost}k)` : `🚗💨 ${N(e.p)} ESCAPES the city! (#${e.order}, pays $${e.cost}k)`;
    case 'arrest': return pt ? `🚨 ${N(e.p)} é preso!` : `🚨 ${N(e.p)} is arrested!`;
    case 'npcStay': return pt ? `${N(e.p)} fica onde está` : `${N(e.p)} stays put`;
    case 'npcWait': return pt ? `${N(e.p)} vigia a saída aberta` : `${N(e.p)} watches the open exit`;
    case 'npcStack': return pt ? `💰 ${N(e.p)} recolhe ${e.n} peça(s)` : `💰 ${N(e.p)} collects ${e.n} tile(s)`;
    case 'npcDiscard': return null;
    case 'fixerDiscard': return pt ? `${N(e.p)} descarta um Fixer` : `${N(e.p)} discards a Fixer`;
    case 'keyDiscard': return pt ? `${N(e.p)} descarta uma chave` : `${N(e.p)} discards a key`;
    case 'lockerDiscard': return pt ? `${N(e.p)} esvazia um cacifo ${I.name(e.color)}` : `${N(e.p)} empties a ${I.name(e.color)} locker`;
    case 'exitDiscard': return pt ? `${N(e.p)} descarta uma peça de saída` : `${N(e.p)} discards an exit tile`;
    case 'gameOver': return pt ? '🏁 Fim do jogo' : '🏁 Game over';
    case 'missionDone': return pt ? `🎯 ${N(e.p)} cumpre a missão!` : `🎯 ${N(e.p)} completes their mission!`;
    case 'missionAbility': return pt ? `${N(e.p)} escolhe uma habilidade da missão` : `${N(e.p)} picks a mission ability`;
    case 'token': return pt ? `${N(e.p)} usa a habilidade diária` : `${N(e.p)} uses their daily ability`;
    case 'notorIgnored': return pt ? `${N(e.p)} ignora 1 de notoriedade` : `${N(e.p)} ignores 1 notoriety`;
    case 'refreshFixer': return pt ? `${N(e.p)} recupera o Fixer ${I.name(e.id)}` : `${N(e.p)} refreshes the ${I.name(e.id)} Fixer`;
    default: return null;
  }
};
I.whyText = function (why) {
  const pt = I.lang === 'pt';
  const m = { income: pt ? 'rendimento' : 'income', business: pt ? 'rendimento do Business' : 'business income', safehouse: pt ? 'rendimento da Casa Segura' : 'safe house income', exit: pt ? 'rendimento na saída' : 'exit income',
    crowd: pt ? 'local com outros jogadores' : 'crowded location', contactStar: pt ? 'carta com estrela' : 'starred card', replace: pt ? 'substituição' : 'replacing', hospital: pt ? 'hospital' : 'hospital', safehouseN: '', church: pt ? 'igreja' : 'church',
    lateFee: pt ? 'taxa por cada turno depois da 1.ª fuga' : 'fee after the first escape', exitCost: pt ? 'custo de saída' : 'exit cost', gang: 'gang', buyEquip: pt ? 'equipamento' : 'equipment', buyFixer: 'Fixer', asset: pt ? 'ativo' : 'asset', contact: pt ? 'carta' : 'card', fixer: 'Fixer', buyUnlock: pt ? 'desbloquear ativo' : 'unlock', bonus: pt ? 'bónus' : 'bonus', bribe: pt ? 'suborno' : 'bribe', card: pt ? 'carta' : 'card', power: pt ? 'poder' : 'power', mission: pt ? 'missão' : 'mission', notorietyMax: pt ? 'notoriedade no máximo' : 'notoriety maxed', costa: 'Costa' };
  if (!why) return '';
  if (why.startsWith('police:')) return ' (' + I.t('types.' + why.slice(7)) + ')';
  const w = m[why]; return w ? ` (${w})` : '';
};
if (typeof module !== 'undefined' && module.exports) module.exports = I; else root.HeistI18n = I;
})(this);
