import SVGInjector from "svg-injector"
import { v4 as uuid } from 'uuid'

function element_factory<K extends keyof HTMLElementTagNameMap>(tag_name: K, attributes?: Object, content?: Array<HTMLElement> | HTMLElement | string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag_name)

    // Attribute·s
    if (attributes !== undefined)
        for (const [key, value] of Object.entries(attributes))
            element.setAttribute(key, value)

    // Content
    if (content instanceof HTMLElement)
        element.insertAdjacentElement('beforeend', content)
    else if (typeof content === "string")
        element.innerHTML = content
    else if (content !== undefined) // instance of Array<HTMLElement>
        for (const child of content)
            element.insertAdjacentElement('beforeend', child)

    return element
}

function svg_factory(src: string): HTMLElement {
    const img_elem = element_factory('img', { src: src })
    setTimeout(() => { SVGInjector(img_elem) }, 0)
    return img_elem
}

export namespace Participant {

    interface ParticipantListEventMap {
        "create": CustomEvent<Participant>
        "update": Event
    }

    export type ParticipantListRawData = Array<ParticipantRawData>

    export class Editor {
        #root: HTMLDivElement
        #participants_list_container: HTMLDivElement
        #participant_list: Array<Participant>

        constructor() {
            this.#participant_list = []
            this.#participants_list_container = element_factory('div', { class: 'participants_list' })

            const add_participant_button = element_factory('button', { id: 'add_participant_button' }, [
                svg_factory('/img/Add.svg'),
                element_factory('div', {}, "Ajouter un·e participant·e"),
            ])

            add_participant_button.addEventListener('click', () => {
                this.add_participant()
            })

            this.#root = element_factory('div', {}, [
                this.#participants_list_container,
                add_participant_button
            ])
        }

        addEventListener<K extends keyof ParticipantListEventMap>(type: K, listener: (this: Participant, ev: ParticipantListEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }

        get participant_list(): Array<Participant> { return this.#participant_list }

        get_elem(): HTMLDivElement {
            return this.#root
        }

        add_participant() {
            const new_participant = new Participant(this)

            // Events
            new_participant.addEventListener('create', () => {
                this.#participant_list.push(new_participant)
                this.#root.dispatchEvent(new CustomEvent('create', { detail: new_participant }))
                this.#root.dispatchEvent(new Event('update'))
                new_participant.addEventListener('update', () => {
                    this.#root.dispatchEvent(new Event('update'))
                })
                new_participant.addEventListener('delete', () => {
                    this.#participant_list.splice(this.#participant_list.indexOf(new_participant), 1)
                    this.#root.dispatchEvent(new Event('update'))
                }, { once: true })
            }, { once: true })

            this.#participants_list_container.insertAdjacentElement('beforeend', new_participant.get_elem())
            new_participant.focus()
        }

        participant_picker_factory(select_name: string, excluded_uuid?: string, default_text?: string, selected_uuid?: string): HTMLSelectElement {
            function participant_option(participant: Participant): HTMLOptionElement {
                const option_elem = element_factory('option', { value: participant.get_uuid() }, participant.name)
                participant.addEventListener('update', () => { option_elem.innerText = participant.name })
                participant.addEventListener('delete', () => { option_elem.remove() }, { once: true })
                return option_elem
            }

            const select = element_factory('select', { name: select_name }, this.participant_list.filter(participant => participant.get_uuid() != excluded_uuid).map(participant_option))
            if (default_text !== undefined)
                select.insertAdjacentElement('afterbegin', element_factory('option', { selected: '' }, default_text))
            // Selected
            if (selected_uuid !== undefined) {
                const option_to_select = select.querySelector(`option[value="${selected_uuid}"]`)
                if (option_to_select !== null)
                    (option_to_select as HTMLOptionElement).selected = true
            }
            // New participant event
            this.addEventListener('create', (event: Event) => {
                const new_participant = (event as CustomEvent<Participant>).detail
                select.appendChild(participant_option(new_participant))
            })
            return select
        }

        get_participant_by_uuid(uuid: string): Participant | undefined {
            return this.#participant_list.find(participant => participant.get_uuid() == uuid)
        }

        get_raw_data(): ParticipantListRawData {
            return this.#participant_list.map((participant: Participant) => {
                return participant.get_raw_data()
            })
        }
        set_from_raw_data(raw_data: ParticipantListRawData) {
            this.#participants_list_container.innerHTML = ''
            this.#participant_list = []
            for (const participant_raw_data of raw_data) {
                const new_participant = new Participant(this)
                new_participant.set_from_raw_data(participant_raw_data)
                this.#participant_list.push(new_participant)

                // Events
                new_participant.addEventListener('update', () => {
                    this.#root.dispatchEvent(new Event('update'))
                })
                new_participant.addEventListener('delete', () => {
                    this.#participant_list.splice(this.#participant_list.indexOf(new_participant), 1)
                    this.#root.dispatchEvent(new Event('update'))
                }, { once: true })

                this.#participants_list_container.insertAdjacentElement('beforeend', new_participant.get_elem())
            }
        }
    }

    interface ParticipantEventMap {
        "create": Event // Fired only once
        "update": Event
        "delete": Event // Fired only once
    }

    type ParticipantRawData = {
        name: string,
        uuid: string,
    }

    export class Participant {
        #parent_list: Editor
        #uuid: string
        #root: HTMLDivElement
        #input: HTMLInputElement
        #first_input_listener?: () => void

        constructor(parent_list: Editor) {
            this.#parent_list = parent_list
            this.#uuid = uuid()
            this.#input = element_factory('input', { type: 'text', placeholder: 'Pseudonyme', size: '1' })
            const delete_button = element_factory('button', { class: 'delete_participant_button', type: 'button' }, svg_factory('/img/Delete.svg'))
            this.#root = element_factory(
                'div',
                { class: 'participant_definition' },
                [
                    this.#input,
                    delete_button,
                ]
            )

            // Create or update on input
            this.#first_input_listener = () => {
                this.#first_input_listener = undefined
                this.#root.dispatchEvent(new Event('create'))
                this.#input.addEventListener('input', () => {
                    this.#root.dispatchEvent(new Event('update'))
                })
            }
            this.#input.addEventListener('input', this.#first_input_listener, { once: true })
            // New participant on enter key up
            this.#input.addEventListener('keyup', (event) => {
                if (event.key === 'Enter' && this.#input.value.length > 0) this.#parent_list.add_participant()
            })
            // Delete on focus out if value == '' or delete button
            this.#input.addEventListener('focusout', () => { if (this.#input.value.length === 0) this.remove_elem(); })
            delete_button.addEventListener('click', () => { this.remove_elem() })
        }

        addEventListener<K extends keyof ParticipantEventMap>(type: K, listener: (this: Participant, ev: ParticipantEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type, listener, options)
        }

        get_elem(): HTMLDivElement {
            return this.#root
        }

        get name() { return this.#input.value }
        set name(value: string) { this.#input.value = value }

        get_uuid(): string {
            return this.#uuid
        }

        focus() { this.#input.focus() }

        remove_elem() {
            this.#root.dispatchEvent(new Event('delete'))
            this.#root.remove()
        }

        get_raw_data() {
            return { name: this.name, uuid: this.#uuid }
        }
        set_from_raw_data(raw_data: ParticipantRawData) {
            this.name = raw_data.name
            this.#uuid = raw_data.uuid

            // Events
            if (this.#first_input_listener !== undefined) {
                this.#input.removeEventListener('input', this.#first_input_listener)
                this.#input.addEventListener('input', () => {
                    this.#root.dispatchEvent(new Event('update'))
                })
            }
        }
    }

} // namespace Participant

export namespace History {

    export const CURRENT_YEAR = new Date().getFullYear()
    export const ALLOWED_YEAR_LIST = ((current_year: number) => { return [...Array(10).keys()].map(index => current_year - index) })(CURRENT_YEAR)

    interface ExchangeData {
        uuid: string,
        from_uuid: string,
        to_uuid: string,
        year: number
    }

    interface HistoryEventMap {
        "update": Event
    }

    export type HistoryRawData = Array<ExchangeData>

    export class Editor {
        #participant_list: Participant.Editor
        #root: HTMLDivElement
        #exchanges: Array<ExchangeData>

        // Views
        #view_radio: HTMLDivElement
        #year_view: ViewYear
        #participant_view: ViewParticipant
        #views: Array<View>

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list

            this.#exchanges = []

            // View radio
            function view_radio_option_factory(label: string, value: string, title: string, checked: boolean = false): HTMLLabelElement {
                const label_elem = element_factory('label', { tabindex: '0', unselectable: 'on', title: title }, label)
                const input_elem = element_factory('input', { type: 'radio', name: 'history_view_radio', value: value, style: 'display: none;' })
                if (checked)
                    input_elem.checked = true
                label_elem.appendChild(input_elem)
                return label_elem
            }
            this.#view_radio = element_factory('div', { class: 'view_radio' }, [
                view_radio_option_factory('Année', 'year', 'Vue par années', true),
                view_radio_option_factory('Offreu·r·se', 'giver', 'Vue par offreu·r·se'),
            ])

            this.#year_view = new ViewYear(participant_list)

            this.#participant_view = new ViewParticipant(participant_list)

            this.#views = [this.#year_view, this.#participant_view]
            { // Views' events
                const handle_create = (event: CustomEvent<ExchangeData>) => { this.#handle_create(event) }
                const handle_udpate = (event: CustomEvent<ExchangeData>) => { this.#handle_udpate(event) }
                const handle_delete = (event: CustomEvent<string>) => { this.#handle_delete(event) }
                for (const view of this.#views) {
                    view.addEventListener('create', handle_create)
                    view.addEventListener('update', handle_udpate)
                    view.addEventListener('delete', handle_delete)
                }
            }
            this.#root = element_factory('div', { class: 'history' }, [
                this.#view_radio,
                this.#year_view.get_elem(),
                this.#participant_view.get_elem(),
            ])

            // Participants deletion event handling
            this.#participant_list.addEventListener('create', (event: CustomEvent<Participant.Participant>) => { this.#register_participant(event) })
        }

        get_elem() { return this.#root }

        addEventListener<K extends keyof HistoryEventMap>(type: K, listener: (this: Participant.Participant, ev: HistoryEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }

        #register_participant(participant: CustomEvent<Participant.Participant> | Participant.Participant) {
            if (participant instanceof CustomEvent)
                participant = (participant as CustomEvent<Participant.Participant>).detail
            participant.addEventListener('delete', () => { this.#handle_participant_deletion(participant) })
        }
        #handle_participant_deletion(participant: Participant.Participant) {
            const deleted_participant_uuid = participant.get_uuid()
            for (const exchange of this.#exchanges) {
                if (exchange.from_uuid == deleted_participant_uuid || exchange.to_uuid == deleted_participant_uuid) {
                    const deleted_exchange_uuid = exchange.uuid
                    this.#exchanges.splice(this.#exchanges.findIndex(old_exchange => old_exchange.uuid == deleted_exchange_uuid), 1)
                    for (const view of this.#views)
                        view.exchange_deleted(deleted_exchange_uuid)
                    this.#root.dispatchEvent(new Event('update'))
                }
            }
        }

        #other_views(a_view_element: HTMLElement): Array<View> {
            return this.#views.filter(view => view.get_elem() != a_view_element)
        }
        #handle_create(event: CustomEvent<ExchangeData>) {
            const new_exchange = event.detail
            this.#exchanges.push(new_exchange)
            for (const view of this.#other_views(event.target as HTMLElement))
                view.exchange_created(new_exchange)
            this.#root.dispatchEvent(new Event('update'))
        }
        #handle_udpate(event: CustomEvent<ExchangeData>) {
            const new_exchange = event.detail
            this.#exchanges[this.#exchanges.findIndex(old_exchange => old_exchange.uuid == new_exchange.uuid)] = new_exchange
            for (const view of this.#other_views(event.target as HTMLElement))
                view.exchange_updated(new_exchange)
            this.#root.dispatchEvent(new Event('update'))
        }
        #handle_delete(event: CustomEvent<string>) {
            const deleted_uuid = event.detail
            this.#exchanges.splice(this.#exchanges.findIndex(old_exchange => old_exchange.uuid == deleted_uuid), 1)
            for (const view of this.#other_views(event.target as HTMLElement))
                view.exchange_deleted(deleted_uuid)
            this.#root.dispatchEvent(new Event('update'))
        }

        get_raw_data(): HistoryRawData { return this.#exchanges }
        set_from_raw_data(raw_data: HistoryRawData) {
            for (const participant of this.#participant_list.participant_list)
                this.#register_participant(participant)
            for (const view of this.#views) {
                view.reset()
                for (const exchange_data of raw_data)
                    view.exchange_created(exchange_data)
            }
            this.#exchanges = raw_data
        }
    }

    interface ViewEventMap {
        "create": CustomEvent<ExchangeData>
        "update": CustomEvent<ExchangeData>
        "delete": CustomEvent<string>
    }

    interface View {
        get_elem(): HTMLElement;
        addEventListener<K extends keyof ViewEventMap>(type: K, listener: (this: Participant.Participant, ev: ViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
        reset(): void;
        exchange_created(exchange_data: ExchangeData): void;
        exchange_updated(exchange_data: ExchangeData): void;
        exchange_deleted(uuid: string): void;
    }

    class ViewYear implements View {
        #participant_list: Participant.Editor
        #root: HTMLDivElement

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list
            this.#root = element_factory('div', { class: 'history_view', id: 'history_view_year' }, ALLOWED_YEAR_LIST.map(year => {
                const year_button = element_factory('button', { class: 'history_new_exchange_button', type: 'button' }, [
                    element_factory('div', {}, year.toString()),
                    svg_factory('/img/Add.svg'),
                ])
                year_button.dataset.year = year.toString()
                year_button.addEventListener('click', () => { this.#add_participant(year, year_button) })
                return year_button
            }))
        }

        get_elem() { return this.#root }

        addEventListener<K extends keyof ViewEventMap>(type: K, listener: (this: Participant.Participant, ev: ViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }

        #exchange_change_handler(exchange: HTMLDivElement) {
            const from_uuid: string | undefined = (exchange.querySelector(`select[name="from"] option[value]:checked`) as HTMLOptionElement | null)?.value
            const to_uuid: string | undefined = (exchange.querySelector(`select[name="to"] option[value]:checked`) as HTMLOptionElement | null)?.value
            const exchange_is_valid: boolean = from_uuid !== undefined && to_uuid !== undefined && from_uuid != to_uuid

            if (exchange.dataset.uuid === undefined) { // Not created yet
                if (exchange_is_valid) { // Create
                    exchange.dataset.uuid = uuid()
                    const exchange_data: ExchangeData = {
                        uuid: exchange.dataset.uuid,
                        from_uuid: from_uuid!,
                        to_uuid: to_uuid!,
                        year: parseInt(exchange.dataset.year as string),
                    }
                    this.#root.dispatchEvent(new CustomEvent('create', { detail: exchange_data }))
                }
            } else { // Already created
                if (exchange_is_valid) { // Update
                    const exchange_data: ExchangeData = {
                        uuid: exchange.dataset.uuid,
                        from_uuid: from_uuid!,
                        to_uuid: to_uuid!,
                        year: parseInt(exchange.dataset.year as string),
                    }
                    this.#root.dispatchEvent(new CustomEvent('update', { detail: exchange_data }))
                } else { // Delete
                    this.#root.dispatchEvent(new CustomEvent('delete', { detail: exchange.dataset.uuid }))
                    delete exchange.dataset.uuid
                }
            }
        }

        #exchange_delete_handler(exchange: HTMLDivElement) {
            const uuid = exchange.dataset.uuid
            if (uuid !== undefined)
                this.#root.dispatchEvent(new CustomEvent('delete', { detail: uuid }))
            exchange.remove()
        }

        #exchange_elem_factory(data: ExchangeData | number): HTMLDivElement {
            const from_picker = this.#participant_list.participant_picker_factory('from', undefined, '▾ Offreu·r·se ▾', (data as ExchangeData)?.from_uuid)
            const to_picker = this.#participant_list.participant_picker_factory('to', undefined, '▾ Receveu·r·se ▾', (data as ExchangeData)?.to_uuid)
            const delete_button = element_factory('button', { type: 'button' }, svg_factory('/img/Delete.svg'))

            const exchange = element_factory('div', { class: 'exchange' }, [
                from_picker,
                svg_factory('/img/Arrow right.svg'),
                to_picker,
                delete_button,
            ])
            if (typeof data === 'number') {
                exchange.dataset.year = data.toString()
            } else { // data instanceof ExchangeData
                exchange.dataset.year = data.year.toString()
                exchange.dataset.uuid = data.uuid
            }

            // Events
            const picker_change_handler = () => { this.#exchange_change_handler(exchange) }
            from_picker.addEventListener('change', picker_change_handler)
            to_picker.addEventListener('change', picker_change_handler)
            delete_button.addEventListener('click', () => { this.#exchange_delete_handler(exchange) })

            return exchange
        }

        #add_participant(year: number, button: HTMLButtonElement) {
            button.insertAdjacentElement('afterend', this.#exchange_elem_factory(year))
        }

        reset(): void {
            for (const exchange_elem of this.#root.querySelectorAll(`.exchange`))
                exchange_elem.remove()
        }
        exchange_created(exchange_data: ExchangeData): void {
            const year_button = this.#root.querySelector(`button.history_new_exchange_button[data-year="${exchange_data.year}"]`)
            year_button?.insertAdjacentElement('afterend', this.#exchange_elem_factory(exchange_data))
        }
        exchange_updated(exchange_data: ExchangeData): void {
            this.exchange_deleted(exchange_data.uuid)
            this.exchange_created(exchange_data)
        }
        exchange_deleted(uuid: string): void {
            const outdated_exchange_elem = this.#root.querySelector(`div.exchange[data-uuid="${uuid}"]`)
            if (outdated_exchange_elem === null)
                throw new Error("Outdated exchange couldn't be found.")
            outdated_exchange_elem.remove()
        }
    }

    class ViewParticipant implements View {
        #participant_list: Participant.Editor
        #root: HTMLDivElement

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list
            this.#root = element_factory('div', { class: 'history_view', id: 'history_view_giver' })

            this.#participant_list.addEventListener('create', (event: CustomEvent<Participant.Participant>) => { this.#add_giver(event.detail) })
        }

        get_elem() { return this.#root }

        addEventListener<K extends keyof ViewEventMap>(type: K, listener: (this: Participant.Participant, ev: ViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }

        #add_giver(participant: Participant.Participant) {
            const participant_name_elem = element_factory('div', {}, participant.name)
            const giver_elem = element_factory('button', { type: 'button', class: 'history_new_exchange_button' }, [
                participant_name_elem,
                svg_factory('/img/Add.svg'),
            ])

            giver_elem.dataset.participantUuid = participant.get_uuid()

            participant.addEventListener('update', () => {
                participant_name_elem.innerText = participant.name
            })
            participant.addEventListener('delete', () => {
                giver_elem.remove()
            }, { once: true })

            giver_elem.addEventListener('click', () => { this.#add_exchange(participant.get_uuid()) })

            this.#root.appendChild(giver_elem)
        }

        #add_exchange(from_uuid: string) {
            this.#exchange_sorted_insert(this.#exchange_elem_factory(from_uuid))
        }

        #year_picker(selected_year: number = CURRENT_YEAR) {
            return element_factory('select', { name: 'year' }, ALLOWED_YEAR_LIST.map((year: number) => {
                const option = element_factory('option', { value: year }, year.toString())
                option.selected = year == selected_year
                return option
            }))
        }

        #exchange_elem_factory(data: ExchangeData | string): HTMLDivElement {
            const year_picker = this.#year_picker((data as ExchangeData).year || undefined)
            const to_picker = this.#participant_list.participant_picker_factory('to', (data as ExchangeData).from_uuid || (data as string), '▾ Receveu·r·se ▾', (data as ExchangeData)?.to_uuid)
            const delete_button = element_factory('button', { type: 'button' }, svg_factory('/img/Delete.svg'))

            const exchange = element_factory('div', { class: 'exchange' }, [
                year_picker,
                to_picker,
                delete_button,
            ])
            if (typeof data === 'string') {
                exchange.dataset.fromUuid = data
            } else { // data instanceof ExchangeData
                exchange.dataset.fromUuid = data.from_uuid
                exchange.dataset.uuid = data.uuid
            }

            // Events
            const change_handler = () => { this.#exchange_change_handler(exchange) }
            year_picker.addEventListener('change', change_handler)
            to_picker.addEventListener('change', change_handler)
            delete_button.addEventListener('click', () => { this.#exchange_delete_handler(exchange) })

            return exchange
        }

        #exchange_sorted_insert(exchange: HTMLDivElement) {
            const year: number = parseInt((exchange.querySelector(`select[name="year"] option:checked`) as HTMLOptionElement).value)
            const year_string: string = year.toString()
            if (exchange.dataset.sortedToYear == year_string) return;

            let inserted_before_another_exchange: boolean = false
            for (const other_exchange of this.#root.querySelectorAll(`.exchange[data-from-uuid="${exchange.dataset.fromUuid}"]`)) {
                if (other_exchange == exchange) continue;
                if (parseInt((other_exchange as HTMLElement).dataset.sortedToYear!) <= year) {
                    other_exchange.insertAdjacentElement('beforebegin', exchange)
                    inserted_before_another_exchange = true
                    break
                }
            }
            if (!inserted_before_another_exchange) {
                const next_button: Element | undefined = this.#root.querySelectorAll(`button.history_new_exchange_button[data-participant-uuid="${exchange.dataset.fromUuid}"] ~ button.history_new_exchange_button`)[0]
                if (next_button !== undefined) // Before next button
                    next_button.insertAdjacentElement('beforebegin', exchange)
                else // Before parent end
                    this.#root.insertAdjacentElement('beforeend', exchange)
            }

            exchange.dataset.sortedToYear = year_string
        }

        #exchange_change_handler(exchange: HTMLDivElement) {
            const from_uuid: string = exchange.dataset.fromUuid!
            const year: number = parseInt((exchange.querySelector(`select[name="year"] option:checked`) as HTMLOptionElement).value)
            const to_uuid: string | undefined = (exchange.querySelector(`select[name="to"] option[value]:checked`) as HTMLOptionElement | null)?.value

            this.#exchange_sorted_insert(exchange)

            if (exchange.dataset.uuid === undefined) { // Not created yet
                if (to_uuid !== undefined) { // Create
                    exchange.dataset.uuid = uuid()
                    const exchange_data: ExchangeData = {
                        uuid: exchange.dataset.uuid,
                        from_uuid: from_uuid,
                        to_uuid: to_uuid,
                        year: year,
                    }
                    this.#root.dispatchEvent(new CustomEvent('create', { detail: exchange_data }))
                }
            } else { // Already created
                // Update
                const exchange_data: ExchangeData = {
                    uuid: exchange.dataset.uuid,
                    from_uuid: from_uuid,
                    to_uuid: to_uuid!, // Cannot select without value after a value was selected
                    year: year,
                }
                this.#root.dispatchEvent(new CustomEvent('update', { detail: exchange_data }))
            }
        }
        #exchange_delete_handler(exchange: HTMLDivElement) {
            { // Delete event dispatch
                const exchange_uuid = exchange.dataset.uuid
                if (exchange_uuid !== undefined)
                    this.#root.dispatchEvent(new CustomEvent('delete', { detail: exchange_uuid }))
            }
            exchange.remove()
        }

        reset(): void {
            this.#root.innerHTML = ''
            for (const participant of this.#participant_list.participant_list)
                this.#add_giver(participant)
        }
        exchange_created(exchange_data: ExchangeData): void {
            this.#exchange_sorted_insert(this.#exchange_elem_factory(exchange_data))
        }
        exchange_updated(exchange_data: ExchangeData): void {
            this.exchange_deleted(exchange_data.uuid)
            this.exchange_created(exchange_data)
        }
        exchange_deleted(uuid: string): void {
            const outdated_exchange_elem = this.#root.querySelector(`div.exchange[data-uuid="${uuid}"]`)
            if (outdated_exchange_elem === null)
                throw new Error("Outdated exchange couldn't be found.")
            outdated_exchange_elem.remove()
        }
    }

} // namespace History

export namespace Group {

    interface GroupListEventMap {
        "update": Event
    }
    export type GroupListRawData = Array<GroupRawData>

    export class Editor {
        #participant_list: Participant.Editor
        #root: HTMLDivElement
        #groups_raw_data: GroupListRawData

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list

            const new_group_section = this.#new_group_section()

            this.#root = element_factory('div', { class: 'group_list' }, new_group_section)
            this.#groups_raw_data = []
        }

        get_elem() { return this.#root }

        addEventListener<K extends keyof GroupListEventMap>(type: K, listener: (this: Participant.Participant, ev: GroupListEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }

        #new_group_section(): HTMLDivElement {
            const new_mutual_btn = element_factory('button', { class: 'new_group_button', type: 'button', title: MutualExclusion.get_short_text() }, MutualExclusion.get_icon())
            const new_oneway_btn = element_factory('button', { class: 'new_group_button', type: 'button', title: OneWayExclusion.get_short_text() }, OneWayExclusion.get_icon())
            const new_linked_btn = element_factory('button', { class: 'new_group_button', type: 'button', title: Linked.get_short_text() }, Linked.get_icon())

            // On clicks
            new_mutual_btn.addEventListener('click', () => { this.#new_blank_group_mutual() })
            new_oneway_btn.addEventListener('click', () => { this.#new_blank_group_oneway() })
            new_linked_btn.addEventListener('click', () => { this.#new_blank_group_linked() })

            return element_factory('div', { class: 'new_group_section' }, [
                element_factory('div', { class: 'new_group_btn_list_label' }, 'Ajouter un groupe :'),
                element_factory('div', { class: 'new_group_btn_list' }, [
                    new_mutual_btn,
                    new_oneway_btn,
                    new_linked_btn,
                ]),
            ])
        }

        #insert_and_listen_group(new_group: GroupType) {
            // Elem
            this.#root.insertAdjacentElement('beforeend', new_group.get_elem())

            // Raw data
            const new_group_raw_data: GroupRawData = {
                type_key: new_group.type_key,
                raw_data: new_group.get_raw_data(),
            }
            this.#groups_raw_data.push(new_group_raw_data)

            // Events
            new_group.addEventListener('update', () => {
                new_group_raw_data.raw_data = new_group.get_raw_data()
                this.#root.dispatchEvent(new Event('update'))
            })
            new_group.addEventListener('delete', () => {
                this.#groups_raw_data.splice(this.#groups_raw_data.indexOf(new_group_raw_data), 1)
                this.#root.dispatchEvent(new Event('update'))
            })
        }

        #new_blank_group_mutual() { this.#insert_and_listen_group(new MutualExclusion(this.#participant_list)) }
        #new_blank_group_oneway() { this.#insert_and_listen_group(new OneWayExclusion(this.#participant_list)) }
        #new_blank_group_linked() { this.#insert_and_listen_group(new Linked(this.#participant_list)) }

        get_raw_data(): GroupListRawData { return this.#groups_raw_data }
        set_from_raw_data(raw_data: GroupListRawData) {
            for (const elem of Array.from(this.#root.children).slice(1))
                elem.remove()
            for (const group_data of raw_data) {
                switch (group_data.type_key) {
                    case 'mutual_exclusion': {
                        const new_group = new MutualExclusion(this.#participant_list)
                        new_group.set_from_raw_data(group_data.raw_data as MutualExclusionGroupRawData)
                        this.#insert_and_listen_group(new_group)
                        break;
                    }
                    case 'one_way_exclusion': {
                        const new_group = new OneWayExclusion(this.#participant_list)
                        new_group.set_from_raw_data(group_data.raw_data as OneWayExclusionGroupRawData)
                        this.#insert_and_listen_group(new_group)
                        break;
                    }
                    case 'linked': {
                        const new_group = new Linked(this.#participant_list)
                        new_group.set_from_raw_data(group_data.raw_data as LinkedGroupRawData)
                        this.#insert_and_listen_group(new_group)
                        break;
                    }

                    default:
                        throw new Error(`Unimplemented group key "${group_data.type_key}"`)
                }
            }
        }
    }

    interface GroupTypeEventMap {
        "update": Event
        "delete": Event
    }

    interface GroupType {
        readonly type_key: string
        get_elem(): HTMLElement;
        addEventListener<K extends keyof GroupTypeEventMap>(type: K, listener: (this: Participant.Participant, ev: GroupTypeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
        // get_icon(): HTMLElement; // incompatible with static
        // get_short_text(): string; // incompatible with static
        get_raw_data(): AnyGroupRawData;
        set_from_raw_data(raw_data: AnyGroupRawData): void;
    }

    type GroupRawData = {
        type_key: string
        raw_data: AnyGroupRawData
    }

    type AnyGroupRawData = MutualExclusionGroupRawData | OneWayExclusionGroupRawData | LinkedGroupRawData
    type MutualExclusionGroupRawData = Array<string>
    type OneWayExclusionGroupRawData = { from: Array<string>, to: Array<string> }
    type LinkedGroupRawData = Array<string>

    class MutualExclusion implements GroupType {
        #participant_list: Participant.Editor
        #root: HTMLDivElement
        #add_member_select: HTMLSelectElement
        #member_list: HTMLDivElement

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list
            const delete_button = element_factory('button', { type: 'button', title: 'Supprimer ce groupe' }, svg_factory('/img/Delete.svg'))
            const header = element_factory('div', { class: 'group_header' }, [
                MutualExclusion.get_icon(),
                element_factory('div', {}, MutualExclusion.get_short_text()),
                delete_button,
            ])
            this.#add_member_select = this.#participant_list.participant_picker_factory('add_member', undefined, '▾ Ajouter un·e participant·e ▾')
            this.#member_list = element_factory('div', { class: 'member_list' })

            this.#root = element_factory('div', { class: 'mutual_exclusion_group group' }, [
                header,
                this.#add_member_select,
                this.#member_list,
            ])

            // Events
            delete_button.addEventListener('click', () => {
                this.#root.dispatchEvent(new Event('delete'))
                this.#root.remove()
            })
            this.#add_member_select.addEventListener('change', () => {
                this.#add_member_by_uuid(this.#add_member_select.value)
            })
        }
        get_elem(): HTMLDivElement { return this.#root }
        get type_key() { return 'mutual_exclusion' }
        addEventListener<K extends keyof GroupTypeEventMap>(type: K, listener: (this: Participant.Participant, ev: GroupTypeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }
        static get_icon(): HTMLDivElement {
            return element_factory('div', { class: 'group_icon mutual_exclusion_group_icon' }, [
                svg_factory('/img/Group mutual exclusion.svg'),
                svg_factory('/img/Not.svg'),
            ])
        }
        static get_short_text(): string { return 'Exclusion mutuelle' }

        #add_member_by_uuid(uuid: string) {
            this.#add_member(this.#participant_list.get_participant_by_uuid(uuid)!);
            (this.#add_member_select.querySelector(`option[value="${uuid}"]`) as HTMLOptionElement).dataset.excluded = '';
            (this.#add_member_select.querySelector('option[selected]') as HTMLOptionElement).selected = true
        }
        #add_member(participant: Participant.Participant) {
            const name_elem = element_factory('div', undefined, participant.name)
            const remove_member_btn = element_factory('button', { type: 'button', title: `Retirer ${participant.name} du groupe` }, svg_factory('/img/Delete.svg'))
            const participant_element = element_factory('div', undefined, [
                name_elem,
                remove_member_btn,
            ])
            participant_element.dataset.uuid = participant.get_uuid()
            this.#member_list.insertAdjacentElement('afterbegin', participant_element)

            this.#root.dispatchEvent(new Event('update'))

            // Events
            remove_member_btn.addEventListener('click', () => { this.#remove_member(participant_element) })
            participant.addEventListener('update', () => { name_elem.innerText = participant.name })
            participant.addEventListener('delete', () => { this.#remove_member(participant_element) })
        }
        #remove_member(participant_element: HTMLElement) {
            delete (this.#add_member_select.querySelector(`option[value="${participant_element.dataset.uuid}"]`) as HTMLOptionElement | null)?.dataset.excluded
            participant_element.remove()
            this.#root.dispatchEvent(new Event('update'))
        }

        get_raw_data(): MutualExclusionGroupRawData { return Array.from(this.#member_list.children, elem => (elem as HTMLElement).dataset.uuid!) }
        set_from_raw_data(raw_data: MutualExclusionGroupRawData): void {
            this.#member_list.innerHTML = ''
            for (const member_uuid of raw_data.reverse())
                this.#add_member_by_uuid(member_uuid)
        }
    }

    class OneWayExclusion implements GroupType {
        #participant_list: Participant.Editor
        #root: HTMLDivElement
        #add_member_from_select: HTMLSelectElement
        #member_from_list: HTMLDivElement
        #add_member_to_select: HTMLSelectElement
        #member_to_list: HTMLDivElement

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list
            const delete_button = element_factory('button', { type: 'button', title: 'Supprimer ce groupe' }, svg_factory('/img/Delete.svg'))
            const header = element_factory('div', { class: 'group_header' }, [
                OneWayExclusion.get_icon(),
                element_factory('div', {}, OneWayExclusion.get_short_text()),
                delete_button,
            ])
            this.#add_member_from_select = this.#participant_list.participant_picker_factory('add_member_from', undefined, '▾ Ajouter un·e offreu·r·se ▾')
            this.#member_from_list = element_factory('div', { class: 'member_list' })
            this.#add_member_to_select = this.#participant_list.participant_picker_factory('add_member_to', undefined, '▾ Ajouter un·e receveu·r·se ▾')
            this.#member_to_list = element_factory('div', { class: 'member_list' })

            this.#root = element_factory('div', { class: 'oneway_exclusion_group group' }, [
                header,
                this.#add_member_from_select,
                this.#member_from_list,
                this.#add_member_to_select,
                this.#member_to_list,
            ])

            // Events
            delete_button.addEventListener('click', () => {
                this.#root.dispatchEvent(new Event('delete'))
                this.#root.remove()
            })
            this.#add_member_from_select.addEventListener('change', () => {
                this.#add_member_from_by_uuid(this.#add_member_from_select.value)
            })
            this.#add_member_to_select.addEventListener('change', () => {
                this.#add_member_to_by_uuid(this.#add_member_to_select.value)
            })
        }
        get_elem(): HTMLDivElement { return this.#root }
        get type_key() { return 'one_way_exclusion' }
        addEventListener<K extends keyof GroupTypeEventMap>(type: K, listener: (this: Participant.Participant, ev: GroupTypeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }
        static get_icon(): HTMLDivElement {
            return element_factory('div', { class: 'group_icon one_way_exclusion_group_icon' }, [
                svg_factory('/img/One way exclusion.svg'),
                svg_factory('/img/Not.svg'),
            ])
        }
        static get_short_text(): string { return 'Exclusion à sens unique' }

        #add_member_from_by_uuid(uuid: string) {
            this.#add_member_from(this.#participant_list.get_participant_by_uuid(uuid)!);
            (this.#add_member_from_select.querySelector(`option[value="${uuid}"]`) as HTMLOptionElement).dataset.excluded = '';
            (this.#add_member_from_select.querySelector('option[selected]') as HTMLOptionElement).selected = true
        }
        #add_member_from(participant: Participant.Participant) {
            const name_elem = element_factory('div', undefined, participant.name)
            const remove_member_btn = element_factory('button', { type: 'button', title: `Retirer ${participant.name} du groupe` }, svg_factory('/img/Delete.svg'))
            const participant_element = element_factory('div', undefined, [
                name_elem,
                remove_member_btn,
            ])
            participant_element.dataset.uuid = participant.get_uuid()
            this.#member_from_list.insertAdjacentElement('afterbegin', participant_element)

            this.#root.dispatchEvent(new Event('update'))

            // Events
            remove_member_btn.addEventListener('click', () => { this.#remove_member_from(participant_element) })
            participant.addEventListener('update', () => { name_elem.innerText = participant.name })
            participant.addEventListener('delete', () => { this.#remove_member_from(participant_element) })
        }
        #remove_member_from(participant_element: HTMLElement) {
            delete (this.#add_member_from_select.querySelector(`option[value="${participant_element.dataset.uuid}"]`) as HTMLOptionElement | null)?.dataset.excluded
            participant_element.remove()
            this.#root.dispatchEvent(new Event('update'))
        }
        #add_member_to_by_uuid(uuid: string) {
            this.#add_member_to(this.#participant_list.get_participant_by_uuid(uuid)!);
            (this.#add_member_to_select.querySelector(`option[value="${uuid}"]`) as HTMLOptionElement).dataset.excluded = '';
            (this.#add_member_to_select.querySelector('option[selected]') as HTMLOptionElement).selected = true
        }
        #add_member_to(participant: Participant.Participant) {
            const name_elem = element_factory('div', undefined, participant.name)
            const remove_member_btn = element_factory('button', { type: 'button', title: `Retirer ${participant.name} du groupe` }, svg_factory('/img/Delete.svg'))
            const participant_element = element_factory('div', undefined, [
                name_elem,
                remove_member_btn,
            ])
            participant_element.dataset.uuid = participant.get_uuid()
            this.#member_to_list.insertAdjacentElement('afterbegin', participant_element)

            this.#root.dispatchEvent(new Event('update'))

            // Events
            remove_member_btn.addEventListener('click', () => { this.#remove_member_to(participant_element) })
            participant.addEventListener('update', () => { name_elem.innerText = participant.name })
            participant.addEventListener('delete', () => { this.#remove_member_to(participant_element) })
        }
        #remove_member_to(participant_element: HTMLElement) {
            delete (this.#add_member_to_select.querySelector(`option[value="${participant_element.dataset.uuid}"]`) as HTMLOptionElement | null)?.dataset.excluded
            participant_element.remove()
            this.#root.dispatchEvent(new Event('update'))
        }

        get_raw_data(): OneWayExclusionGroupRawData {
            return {
                from: Array.from(this.#member_from_list.children, elem => (elem as HTMLElement).dataset.uuid!),
                to: Array.from(this.#member_to_list.children, elem => (elem as HTMLElement).dataset.uuid!),
            }
        }
        set_from_raw_data(raw_data: OneWayExclusionGroupRawData): void {
            // From
            this.#member_from_list.innerHTML = ''
            for (const member_uuid of raw_data.from.reverse())
                this.#add_member_from_by_uuid(member_uuid)
            // To
            this.#member_to_list.innerHTML = ''
            for (const member_uuid of raw_data.to.reverse())
                this.#add_member_to_by_uuid(member_uuid)
        }
    }

    class Linked implements GroupType {
        #participant_list: Participant.Editor
        #root: HTMLDivElement
        #add_member_select: HTMLSelectElement
        #member_list: HTMLDivElement

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list
            const delete_button = element_factory('button', { type: 'button', title: 'Supprimer ce groupe' }, svg_factory('/img/Delete.svg'))
            const header = element_factory('div', { class: 'group_header' }, [
                Linked.get_icon(),
                element_factory('div', {}, Linked.get_short_text()),
                delete_button,
            ])
            this.#add_member_select = this.#participant_list.participant_picker_factory('add_member', undefined, '▾ Ajouter un·e participant·e ▾')
            this.#member_list = element_factory('div', { class: 'member_list' })

            this.#root = element_factory('div', { class: 'mutual_exclusion_group group' }, [
                header,
                this.#add_member_select,
                this.#member_list,
            ])

            // Events
            delete_button.addEventListener('click', () => {
                this.#root.dispatchEvent(new Event('delete'))
                this.#root.remove()
            })
            this.#add_member_select.addEventListener('change', () => {
                this.#add_member_by_uuid(this.#add_member_select.value)
            })
        }
        get_elem(): HTMLDivElement { return this.#root }
        get type_key() { return 'linked' }
        addEventListener<K extends keyof GroupTypeEventMap>(type: K, listener: (this: Participant.Participant, ev: GroupTypeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }
        static get_icon(): HTMLDivElement {
            return element_factory('div', { class: 'group_icon linked_group_icon' }, [
                svg_factory('/img/Linked.svg'),
            ])
        }
        static get_short_text(): string { return 'Liés, couple…' }

        #add_member_by_uuid(uuid: string) {
            this.#add_member(this.#participant_list.get_participant_by_uuid(uuid)!);
            (this.#add_member_select.querySelector(`option[value="${uuid}"]`) as HTMLOptionElement).dataset.excluded = '';
            (this.#add_member_select.querySelector('option[selected]') as HTMLOptionElement).selected = true
        }
        #add_member(participant: Participant.Participant) {
            const name_elem = element_factory('div', undefined, participant.name)
            const remove_member_btn = element_factory('button', { type: 'button', title: `Retirer ${participant.name} du groupe` }, svg_factory('/img/Delete.svg'))
            const participant_element = element_factory('div', undefined, [
                name_elem,
                remove_member_btn,
            ])
            participant_element.dataset.uuid = participant.get_uuid()
            this.#member_list.insertAdjacentElement('afterbegin', participant_element)

            this.#root.dispatchEvent(new Event('update'))

            // Events
            remove_member_btn.addEventListener('click', () => { this.#remove_member(participant_element) })
            participant.addEventListener('update', () => { name_elem.innerText = participant.name })
            participant.addEventListener('delete', () => { this.#remove_member(participant_element) })
        }
        #remove_member(participant_element: HTMLElement) {
            delete (this.#add_member_select.querySelector(`option[value="${participant_element.dataset.uuid}"]`) as HTMLOptionElement | null)?.dataset.excluded
            participant_element.remove()
            this.#root.dispatchEvent(new Event('update'))
        }

        get_raw_data(): LinkedGroupRawData { return Array.from(this.#member_list.children, elem => (elem as HTMLElement).dataset.uuid!) }
        set_from_raw_data(raw_data: LinkedGroupRawData): void {
            this.#member_list.innerHTML = ''
            for (const member_uuid of raw_data.reverse())
                this.#add_member_by_uuid(member_uuid)
        }
    }

}

export namespace Next {

    export class Editor {
        #participant: Participant.Editor
        #history: History.Editor
        #group: Group.Editor

        #root: HTMLDivElement

        constructor(participant: Participant.Editor, history: History.Editor, group: Group.Editor) {
            this.#participant = participant
            this.#history = history
            this.#group = group

            const control = element_factory('div', { class: 'control' }, [
                // TODO Year (choice if close to christmas)
                // TODO Number of gifts/person
            ])

            this.#root = element_factory('div', { class: 'next' }, [
                control,
            ])
        }

        get_elem() { return this.#root }
    }

} // namespace Next
