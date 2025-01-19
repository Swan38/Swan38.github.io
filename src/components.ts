import SVGInjector from "svg-injector"
import { v4 as uuid } from 'uuid'

// import { Participant, get_stored_participant_list } from "./data"

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

declare global {
    interface HTMLElement {
        object?: Object
    }
}

function svg_inject_later(svg_element: HTMLImageElement): HTMLImageElement {
    setTimeout(() => { SVGInjector(svg_element) }, 0)
    return svg_element
}

// #region Participants

interface ParticipantListEventMap {
    "create": CustomEvent<Participant>
    "update": Event
    // "delete": Event
}

export type ParticipantListRawData = Array<ParticipantRawData>

export class ParticipantList {
    #root: HTMLDivElement
    #participants_list_container: HTMLDivElement
    #participant_list: Array<Participant>

    constructor() {
        this.#participant_list = []
        this.#participants_list_container = element_factory('div', { class: 'participants_list' })

        const add_participant_button = element_factory('button', { id: 'add_participant_button' }, [
            svg_inject_later(element_factory('img', { src: '/img/Add.svg' })),
            element_factory('div', {}, "Ajouter un participant"),
        ])

        add_participant_button.addEventListener('click', () => {
            this.add_participant()
        })

        this.#root = element_factory('div', {}, [
            this.#participants_list_container,
            add_participant_button
        ])
        this.#root.object = this
    }

    addEventListener<K extends keyof ParticipantListEventMap>(type: K, listener: (this: Participant, ev: ParticipantListEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.#root.addEventListener(type as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
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

class Participant {
    #parent_list: ParticipantList
    #uuid: string
    #root: HTMLDivElement
    #input: HTMLInputElement
    #first_input_listener?: () => void

    constructor(parent_list: ParticipantList) {
        this.#parent_list = parent_list
        this.#uuid = uuid()
        this.#input = element_factory('input', { type: 'text', placeholder: 'Pseudonyme', size: '1' })
        const delete_image = element_factory('img', { src: '/img/Delete.svg' })
        const delete_button = element_factory('button', { class: 'delete_participant_button', type: 'button' }, svg_inject_later(delete_image))
        this.#root = element_factory(
            'div',
            { class: 'participant_definition' },
            [
                this.#input,
                delete_button,
            ]
        )
        this.#root.object = this

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
        this.#input.addEventListener('focusout', (event) => {
            if (event.relatedTarget === delete_button || this.#input.value.length === 0) {
                this.remove_elem()
            }
        })
        // delete_button.addEventListener('click', () => { this.remove() }) // focusout...
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

// #endregion Participants

// #region History

interface ExchangeData {
    uuid: string,
    from_uuid: string,
    to_uuid: string,
    year: number
}

export const ALLOWED_YEAR_LIST = ((current_year: number) => { return [...Array(10).keys()].map(index => current_year - index) })(new Date().getFullYear())

export class History {
    // #participant_list: ParticipantList
    #root: HTMLDivElement
    #exchanges: Array<ExchangeData>

    // Views
    #view_radio: HTMLDivElement
    #year_view: HistoryViewYear
    #participant_view: HistoryViewParticipant
    #views: Array<HistoryView>

    constructor(participant_list: ParticipantList) {
        // this.#participant_list = participant_list

        this.#exchanges = []

        // View radio
        function view_radio_option_factory(label: string, value: string, checked: boolean = false): HTMLLabelElement {
            const label_elem = element_factory('label', { tabindex: '0', unselectable: 'on' }, label)
            const input_elem = element_factory('input', { type: 'radio', name: 'history_view_radio', value: value, style: 'display: none;' })
            if (checked)
                input_elem.checked = true
            label_elem.appendChild(input_elem)
            return label_elem
        }
        this.#view_radio = element_factory('div', { class: 'view_radio' }, [
            view_radio_option_factory('Année', 'year', true),
            view_radio_option_factory('Participant', 'participants'),
        ])

        this.#year_view = new HistoryViewYear(participant_list)

        this.#participant_view = new HistoryViewParticipant(participant_list)

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
    }

    get_elem() { return this.#root }

    #handle_create(event: CustomEvent<ExchangeData>) { }
    #handle_udpate(event: CustomEvent<ExchangeData>) { }
    #handle_delete(event: CustomEvent<string>) { }
}

interface HistoryViewEventMap {
    "create": CustomEvent<ExchangeData>
    "update": CustomEvent<ExchangeData>
    "delete": CustomEvent<string>
}

interface HistoryView {
    get_elem(): HTMLElement;
    addEventListener<K extends keyof HistoryViewEventMap>(type: K, listener: (this: Participant, ev: HistoryViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    // exchange_created(exchange_data: ExchangeData): void;
    // exchange_updated(exchange_data: ExchangeData): void;
    // exchange_deleted(uuid: string): void;
}

class HistoryViewYear implements HistoryView {
    #participant_list: ParticipantList
    #root: HTMLDivElement

    constructor(participant_list: ParticipantList) {
        this.#participant_list = participant_list
        this.#root = element_factory('div', { class: 'history_view', id: 'history_view_year' }, ALLOWED_YEAR_LIST.map(year => {
            const year_button = element_factory('button', { class: 'history_year', type: 'button' }, [
                element_factory('div', {}, year.toString()),
                svg_inject_later(element_factory('img', { src: '/img/Add.svg' })),
            ])
            year_button.addEventListener('click', () => { this.#add_participant(year, year_button) })
            return year_button
        }))
    }

    get_elem() { return this.#root }

    addEventListener<K extends keyof HistoryViewEventMap>(type: K, listener: (this: Participant, ev: HistoryViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.#root.addEventListener(type as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
    }

    #exchange_change_handler(exchange: HTMLDivElement) {
        const from_uuid: string | undefined = (exchange.querySelector(`select[name="from"] option[value]:checked`) as HTMLOptionElement | null)?.value
        const to_uuid: string | undefined = (exchange.querySelector(`select[name="to"] option[value]:checked`) as HTMLOptionElement | null)?.value
        const exchange_is_valid: boolean = from_uuid !== undefined && to_uuid !== undefined && from_uuid != to_uuid

        if (exchange.dataset.uuid === undefined) { // Not create yet
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

    #participant_picker(select_name: string, default_text?: string, selected_uuid?: string): HTMLSelectElement {
        function participant_option(participant: Participant): HTMLOptionElement {
            const option_elem = element_factory('option', { value: participant.get_uuid() }, participant.name)
            participant.addEventListener('update', () => { option_elem.innerText = participant.name })
            participant.addEventListener('delete', () => { option_elem.remove() }, { once: true })
            return option_elem
        }

        const select = element_factory('select', { name: select_name }, this.#participant_list.participant_list.map(participant_option))
        if (default_text !== undefined)
            select.insertAdjacentElement('afterbegin', element_factory('option', { selected: '' }, default_text))
        // Selected
        if (selected_uuid !== undefined) {
            const option_to_select = select.querySelector(`option[value="${selected_uuid}"]`)
            if (option_to_select !== null)
                (option_to_select as HTMLOptionElement).selected = true
        }
        // New participant event
        this.#participant_list.addEventListener('create', (event: Event) => {
            const new_participant = (event as CustomEvent<Participant>).detail
            select.appendChild(participant_option(new_participant))
        })
        return select
    }

    #exchange_elem_factory(data: ExchangeData | number): HTMLDivElement {
        const from_picker = this.#participant_picker('from', '▾ Offreu·r·se ▾', (data as ExchangeData)?.from_uuid)
        const to_picker = this.#participant_picker('to', '▾ Receveu·r·se ▾', (data as ExchangeData)?.to_uuid)
        const delete_button = element_factory('button', { type: 'button' }, svg_inject_later(element_factory('img', { src: '/img/Delete.svg' })))

        const exchange = element_factory('div', { class: 'exchange' }, [
            from_picker,
            svg_inject_later(element_factory('img', { src: '/img/Arrow right.svg' })),
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
}

class HistoryViewParticipant implements HistoryView {
    #participant_list: ParticipantList
    #root: HTMLDivElement

    constructor(participant_list: ParticipantList) {
        this.#participant_list = participant_list
        this.#root = element_factory('div', { class: 'history_view', id: 'history_view_participant' }, 'Vue participants')
    }

    get_elem() { return this.#root }

    addEventListener<K extends keyof HistoryViewEventMap>(type: K, listener: (this: Participant, ev: HistoryViewEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.#root.addEventListener(type as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
    }
}

// #endregion History
