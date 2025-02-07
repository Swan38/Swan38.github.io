import SVGInjector from "svg-injector"
import { v4 as uuid } from 'uuid'
import FileSaver from "file-saver"

import { Cookie } from "./cookies"


function clamp(min: number | undefined, value: number, max: number | undefined): number {
    if (min !== undefined && value < min)
        return min
    else if (max !== undefined && value > max)
        return max
    return value
}

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

interface InputNumberAttributes {
    value?: number
    min?: number
    max?: number
    placeholder?: string
    step?: number
}

interface InputNumberEventMap {
    'change': Event
}

class InputNumber {
    #root: HTMLDivElement
    #input: HTMLInputElement
    #init_value: number
    #min: number | undefined
    #max: number | undefined

    constructor(name: string, attributes?: InputNumberAttributes, input_width?: string) {
        this.#input = element_factory('input', Object.assign({ type: 'number', name: name }, attributes || {}))
        if (input_width !== undefined)
            this.#input.setAttribute('style', `--width: ${input_width};`)

        const up = element_factory('button', { type: 'button', tabindex: '-1' })
        const down = element_factory('button', { type: 'button', tabindex: '-1' })

        this.#root = element_factory('div', { class: 'input_number' }, [
            this.#input,
            up,
            down,
        ])

        // Events
        const step: number = attributes?.step || 1
        this.#init_value = clamp(
            attributes?.min,
            attributes?.placeholder === undefined ? 0 : (parseInt(attributes.placeholder) || 0),
            attributes?.max
        )
        this.#min = attributes?.min
        this.#max = attributes?.max
        const take_step_up = () => { this.#take_step(step) }
        const take_step_down = () => { this.#take_step(-step) }
        up.addEventListener('click', take_step_up)
        down.addEventListener('click', take_step_down)
        this.#input.addEventListener('keydown', (event: KeyboardEvent) => {
            switch (event.key) {
                case 'ArrowUp':
                    take_step_up()
                    event.stopImmediatePropagation()
                    event.preventDefault()
                    break;
                case 'ArrowDown':
                    take_step_down()
                    event.stopImmediatePropagation()
                    event.preventDefault()
                    break;
            }
        })
        this.#input.addEventListener('input', () => { this.#dispatchEventChange() })
    }
    get_elem() { return this.#root }

    get value() {
        return parseInt(this.#input.value) || parseInt(this.#input.placeholder)
    }
    set value(value: number) {
        this.#input.value = value.toString()
    }
    value_is_set(): boolean { return this.#input.value.length > 0 }

    #take_step(step: number) {
        this.#input.value = clamp(
            this.#min,
            (parseInt(this.#input.value) || this.#init_value) + step,
            this.#max
        ).toString()
        this.#dispatchEventChange()
        this.#input.focus()
    }

    #dispatchEventChange() { this.#root.dispatchEvent(new Event('change')) }

    addEventListener<K extends keyof InputNumberEventMap>(type: K, listener: (this: Participant.Participant, ev: InputNumberEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
    }
}

class ErrorBox {
    #root: HTMLDivElement
    #message: HTMLDivElement

    constructor() {
        this.#message = element_factory('div', { class: 'message' })
        this.#root = element_factory('div', { class: 'error_box', 'clear': '' }, [
            svg_factory('/img/Error.svg'),
            this.#message,
        ])
    }

    set(message: string) {
        this.#message.innerHTML = message
        this.#root.removeAttribute('clear')
    }
    clear() {
        this.#root.setAttribute('clear', '')
    }

    get_elem() { return this.#root }
}

export namespace Participant {

    export type Uuid = string

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
            let select: HTMLSelectElement

            const participant_option = (participant: Participant): HTMLOptionElement => {
                const option_elem = element_factory('option', { value: participant.uuid }, participant.name)
                participant.addEventListener('update', () => { option_elem.innerText = participant.name })
                participant.addEventListener('delete', () => {
                    option_elem.remove()
                    if (option_elem.selected) {
                        select.dispatchEvent(new Event('input'))
                        select.dispatchEvent(new Event('change'))
                        select.dispatchEvent(new Event('participant_update'))
                    }
                }, { once: true })
                return option_elem
            }

            select = element_factory('select', { name: select_name }, this.participant_list.filter(participant => participant.uuid != excluded_uuid).map(participant_option))
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
            return this.#participant_list.find(participant => participant.uuid == uuid)
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

        get uuid(): string {
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

    export type Uuid = string

    export type ExchangeData = {
        uuid: Uuid
        from_uuid: Participant.Uuid
        to_uuid: Participant.Uuid
        year: number
    }

    interface HistoryEventMap {
        'update': Event
        'create': CustomEvent<ExchangeData>
        'edited': CustomEvent<ExchangeData>
        'delete': CustomEvent<Uuid>
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
            function view_radio_option_factory(label: string, value: string, title: string, default_checked: boolean = false): HTMLLabelElement {
                const label_elem = element_factory('label', { tabindex: '0', unselectable: 'on', title: title }, label)
                const input_elem = element_factory('input', { type: 'radio', name: 'history_view_radio', value: value, style: 'display: none;' })
                if (default_checked)
                    input_elem.setAttribute('checked', '')
                if (value === Cookie.read('selected_history_view_radio'))
                    input_elem.checked = true
                input_elem.addEventListener('change', (event) => {
                    Cookie.write('selected_history_view_radio', (event.target as HTMLInputElement).value, 365 / 2)
                })
                label_elem.appendChild(input_elem)
                return label_elem
            }
            // const selected_history_view_radio = cookie.read('selected_history_view_radio')
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
            const deleted_participant_uuid = participant.uuid
            for (const exchange of this.#exchanges) {
                if (exchange.from_uuid == deleted_participant_uuid || exchange.to_uuid == deleted_participant_uuid) {
                    const deleted_exchange_uuid = exchange.uuid
                    this.#exchanges.splice(this.#exchanges.findIndex(old_exchange => old_exchange.uuid == deleted_exchange_uuid), 1)
                    for (const view of this.#views)
                        view.exchange_deleted(deleted_exchange_uuid)
                    // this.#root.dispatchEvent(new CustomEvent('delete', { detail: deleted_exchange_uuid }))
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
            this.#root.dispatchEvent(new CustomEvent('create', { detail: new_exchange }))
            this.#root.dispatchEvent(new Event('update'))
        }
        #handle_udpate(event: CustomEvent<ExchangeData>) {
            const new_exchange = event.detail
            this.#exchanges[this.#exchanges.findIndex(old_exchange => old_exchange.uuid == new_exchange.uuid)] = new_exchange
            for (const view of this.#other_views(event.target as HTMLElement))
                view.exchange_updated(new_exchange)
            this.#root.dispatchEvent(new CustomEvent('edited', { detail: new_exchange }))
            this.#root.dispatchEvent(new Event('update'))
        }
        #handle_delete(event: CustomEvent<string>) {
            const deleted_uuid = event.detail
            this.#exchanges.splice(this.#exchanges.findIndex(old_exchange => old_exchange.uuid == deleted_uuid), 1)
            for (const view of this.#other_views(event.target as HTMLElement))
                view.exchange_deleted(deleted_uuid)
            this.#root.dispatchEvent(new CustomEvent('delete', { detail: deleted_uuid }))
            this.#root.dispatchEvent(new Event('update'))
        }

        get_exchanges(): Array<ExchangeData> { return this.#exchanges }

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
            const picker_change_handler = () => {
                if (from_picker.value == to_picker.value)
                    exchange.setAttribute('from_equal_to', '')
                else
                    exchange.removeAttribute('from_equal_to')
                this.#exchange_change_handler(exchange)
            }
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

            giver_elem.dataset.participantUuid = participant.uuid

            participant.addEventListener('update', () => {
                participant_name_elem.innerText = participant.name
            })
            participant.addEventListener('delete', () => {
                giver_elem.remove()
            }, { once: true })

            giver_elem.addEventListener('click', () => { this.#add_exchange(participant.uuid) })

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
        'create': CustomEvent<GroupType>
        'update': Event
    }
    export type GroupListRawData = Array<GroupRawData>

    export class Editor {
        #participant_list: Participant.Editor
        #root: HTMLDivElement
        #groups_raw_data: GroupListRawData
        #groups: Array<GroupType>

        constructor(participant_list: Participant.Editor) {
            this.#participant_list = participant_list

            const new_group_section = this.#new_group_section()

            this.#root = element_factory('div', { class: 'group_list' }, new_group_section)
            this.#groups_raw_data = []
            this.#groups = []
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
            this.#groups.push(new_group)

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
                this.#groups.splice(this.#groups.indexOf(new_group), 1)
                this.#root.dispatchEvent(new Event('update'))
            }, { once: true })
        }

        #new_blank_group_mutual() {
            const new_group = new MutualExclusion(this.#participant_list)
            this.#insert_and_listen_group(new_group)
            this.#root.dispatchEvent(new CustomEvent('create', { detail: new_group }))
        }
        #new_blank_group_oneway() {
            const new_group = new OneWayExclusion(this.#participant_list)
            this.#insert_and_listen_group(new_group)
            this.#root.dispatchEvent(new CustomEvent('create', { detail: new_group }))
        }
        #new_blank_group_linked() {
            const new_group = new Linked(this.#participant_list)
            this.#insert_and_listen_group(new_group)
            this.#root.dispatchEvent(new CustomEvent('create', { detail: new_group }))
        }

        get_groups(): Array<GroupType> { return this.#groups }

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
        'update': Event
        'delete': Event
    }

    export interface GroupType {
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

    export interface ExclusionGroupType extends GroupType {
        get_exclusion_from(): Array<Participant.Uuid>
        get_exclusion_to(): Array<Participant.Uuid>
    }

    class MutualExclusion implements ExclusionGroupType {
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
            participant_element.dataset.uuid = participant.uuid
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

        get_exclusion_from(): Array<Participant.Uuid> { return this.get_raw_data() }
        get_exclusion_to(): Array<Participant.Uuid> { return this.get_raw_data() }

        get_raw_data(): MutualExclusionGroupRawData { return Array.from(this.#member_list.children, elem => (elem as HTMLElement).dataset.uuid!) }
        set_from_raw_data(raw_data: MutualExclusionGroupRawData): void {
            this.#member_list.innerHTML = ''
            for (const member_uuid of raw_data.reverse())
                this.#add_member_by_uuid(member_uuid)
        }
    }

    class OneWayExclusion implements ExclusionGroupType {
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
            participant_element.dataset.uuid = participant.uuid
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
            participant_element.dataset.uuid = participant.uuid
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

        get_exclusion_from(): Array<Participant.Uuid> {
            return Array.from(this.#member_from_list.children, elem => (elem as HTMLElement).dataset.uuid!)
        }
        get_exclusion_to(): Array<Participant.Uuid> {
            return Array.from(this.#member_to_list.children, elem => (elem as HTMLElement).dataset.uuid!)
        }

        get_raw_data(): OneWayExclusionGroupRawData {
            return {
                from: this.get_exclusion_from(),
                to: this.get_exclusion_to(),
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

    export class Linked implements GroupType {
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
            participant_element.dataset.uuid = participant.uuid
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

        get_linked_participants(): Array<Participant.Uuid> { return this.get_raw_data() }
        get_raw_data(): LinkedGroupRawData { return Array.from(this.#member_list.children, elem => (elem as HTMLElement).dataset.uuid!) }
        set_from_raw_data(raw_data: LinkedGroupRawData): void {
            this.#member_list.innerHTML = ''
            for (const member_uuid of raw_data.reverse())
                this.#add_member_by_uuid(member_uuid)
        }
    }

}

export namespace Next {

    class GiveToScore {
        #exchanges_scores: Record<History.Uuid, number>
        #total_score

        constructor() {
            this.#exchanges_scores = {}
            this.#total_score = 0
        }

        add(exchange_uuid: History.Uuid, score: number) {
            this.#exchanges_scores[exchange_uuid] = score
            this.#total_score += score
        }
        multiply(lambda: number) {
            for (const exchange_uuid in this.#exchanges_scores)
                this.#exchanges_scores[exchange_uuid] *= lambda
            this.#total_score *= lambda
        }
        update(exchange_uuid: History.Uuid, score: number): boolean {
            if (exchange_uuid in this.#exchanges_scores) {
                this.#total_score -= this.#exchanges_scores[exchange_uuid]
                this.#total_score += this.#exchanges_scores[exchange_uuid] = score
                return true
            } else
                return false
        }
        remove(exchange_uuid: History.Uuid): boolean {
            if (exchange_uuid in this.#exchanges_scores) {
                this.#total_score -= this.#exchanges_scores[exchange_uuid]
                delete this.#exchanges_scores[exchange_uuid]
                return true
            } else
                return false
        }

        get value(): number {
            return this.#total_score
        }
    }

    type GiverData = {
        uuid: Participant.Uuid
        give_to_filtered_sorted: Array<Participant.Uuid>
        give_to_scores: Record<Participant.Uuid, GiveToScore>
        give_to_black_list_count: Record<Participant.Uuid, number>
        linked_to: Record<Participant.Uuid, number>
    }

    type ControlRawData = {
        year?: number
        gift_number?: number
        no_two_loop: boolean
    }
    type ResultRawData = Array<{ from: Participant.Uuid, to: Participant.Uuid }>
    export type NextRawData = {
        control: ControlRawData
        result: ResultRawData
    }

    interface NextEventMap {
        'update': Event
    }

    interface ArrangementError extends Error {
        name: 'ArrangementError'
    }
    function ArrangementError(message: string) {
        const error = new Error(message) as ArrangementError
        error.name = 'ArrangementError'
        return error
    }
    function is_arrangement_error(error: Error): error is ArrangementError {
        return error.name == ArrangementError.name
    }

    export class Editor {
        #participant: Participant.Editor
        #history: History.Editor
        #group: Group.Editor

        #root: HTMLDivElement
        // Control
        #year: InputNumber
        #gift_number: InputNumber
        #avoid_two_loop: HTMLInputElement
        // Error
        #error_box: ErrorBox
        // Result
        #next_exchanges_container: HTMLDivElement

        #exchange_score_ref_year: number
        #giver_datas: Array<GiverData>

        constructor(participant: Participant.Editor, history: History.Editor, group: Group.Editor) {
            this.#participant = participant
            this.#history = history
            this.#group = group

            this.#giver_datas = []

            const control = (() => {
                const DEFAULT_YEAR: number = (() => {
                    // Next year since 25th december
                    const next_week_date = new Date()
                    next_week_date.setTime(next_week_date.getTime() + (7 * 24 * 60 * 60 * 1000))
                    return next_week_date.getFullYear()
                })()
                this.#year = new InputNumber('gift_per_participant', { placeholder: DEFAULT_YEAR.toString() }, `${(DEFAULT_YEAR + 1).toString().length}ch`)
                this.#gift_number = new InputNumber('gift_per_participant', { placeholder: '1', min: 1, max: 99 }, `2ch`)
                this.#avoid_two_loop = element_factory('input', { type: 'checkbox', checked: '' })

                this.#exchange_score_ref_year = DEFAULT_YEAR
                this.#year.addEventListener('change', () => {
                    this.#update_exchange_score_ref_year(this.#year.value)
                    this.#root.dispatchEvent(new Event('update'))
                })
                this.#gift_number.addEventListener('change', () => {
                    this.#root.dispatchEvent(new Event('update'))
                })
                this.#avoid_two_loop.addEventListener('change', () => {
                    this.#root.dispatchEvent(new Event('update'))
                })

                const generate_button = element_factory('button', { type: 'button', class: 'generate_button' }, `Générer ▶`)

                const control = element_factory('div', { class: 'control' }, [
                    element_factory('label', undefined, [
                        element_factory('div', undefined, `Année`),
                        this.#year.get_elem(),
                    ]),
                    element_factory('label', undefined, [
                        element_factory('div', undefined, `Cadeau·x/participant·e`),
                        this.#gift_number.get_elem(),
                    ]),
                    element_factory('label', undefined, [
                        element_factory('div', undefined, `Pas de boucle de deux`),
                        this.#avoid_two_loop,
                    ]),
                    generate_button,
                ])

                // Events
                generate_button.addEventListener('click', () => { this.#control_generate() })

                return control
            })()

            this.#error_box = new ErrorBox()

            const next_exchanges_editor = (() => {
                this.#next_exchanges_container = element_factory('div')
                const sort_next_from_btn = element_factory('button', { type: 'button' }, `Offreu·r·se`)
                const sort_next_to_btn = element_factory('button', { type: 'button' }, `Receveu·r·se`)
                const add_next_exchange_btn = element_factory('button', { type: 'button', class: 'add_next_exchange' }, svg_factory('/img/Add.svg'))

                sort_next_from_btn.addEventListener('click', () => { this.#sort_result_exchange('from') })
                sort_next_to_btn.addEventListener('click', () => { this.#sort_result_exchange('to') })
                add_next_exchange_btn.addEventListener('click', () => { this.#add_result_exchange() })

                return element_factory('div', { class: 'next_exchanges' }, [
                    element_factory('div', { class: 'sort_options' }, [
                        // element_factory('div', undefined, `Trier par`),
                        svg_factory('/img/Sort.svg'),
                        sort_next_from_btn,
                        sort_next_to_btn,
                    ]),
                    this.#next_exchanges_container,
                    add_next_exchange_btn,
                ])
            })()

            const save_section: HTMLDivElement = (() => {
                // Copy
                const copy_button = element_factory('button', { type: 'button', class: 'copy_button' }, [
                    svg_factory('/img/Copy.svg'),
                    element_factory('div', undefined, `Copier un résumé`),
                ])
                copy_button.addEventListener('click', () => { this.#copy_result_abstract() })

                // this_year.csv
                const csv_button = element_factory('button', { type: 'button' }, [
                    svg_factory('/img/File download.svg'),
                    element_factory('div', undefined, `Exporter au format .csv`),
                ])
                csv_button.addEventListener('click', () => { this.#download_result_year() })

                // up_to_this_year.noel
                const noel_button = element_factory('button', { type: 'button' }, [
                    svg_factory('/img/File download.svg'),
                    element_factory('div', undefined, `Exporter avec tout l'historique pour ne rien re-saisire l'année prochaine`),
                ])
                noel_button.addEventListener('click', () => { this.#download_result_with_history() })

                // Save section
                return element_factory('div', { class: 'save_section' }, [
                    copy_button,
                    csv_button,
                    noel_button,
                ])
            })()

            this.#root = element_factory('div', { class: 'next' }, [
                control,
                this.#error_box.get_elem(),
                next_exchanges_editor,
                save_section,
            ])

            // // Init values
            // for (const a_participant of this.#participant.participant_list)
            //     this.#participant_add(a_participant)
            // for (const a_group of this.#group.get_groups())
            //     this.#group_add(a_group)
            // for (const a_exchange of this.#history.get_exchanges())
            //     this.#exchange_add(a_exchange)

            // Events
            this.#participant.addEventListener('create', (event: CustomEvent<Participant.Participant>) => {
                this.#participant_add(event.detail)
            })
            this.#group.addEventListener('create', (event: CustomEvent<Group.GroupType>) => {
                this.#group_add(event.detail)
            })
            this.#history.addEventListener('create', (event: CustomEvent<History.ExchangeData>) => {
                this.#exchange_add(event.detail)
            })
            this.#history.addEventListener('edited', (event: CustomEvent<History.ExchangeData>) => {
                this.#exchange_edited(event.detail)
            })
            this.#history.addEventListener('delete', (event: CustomEvent<History.Uuid>) => {
                this.#exchange_delete(event.detail)
            })
        }

        get_elem() { return this.#root }

        addEventListener<K extends keyof NextEventMap>(type: K, listener: (this: Participant.Participant, ev: NextEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
            this.#root.addEventListener(type as unknown as keyof HTMLElementEventMap, listener as (event: Event) => void, options)
        }

        #participant_add(participant: Participant.Participant) {
            const other_participants: Array<Participant.Uuid> = []
            const other_participants_scores: Record<Participant.Uuid, GiveToScore> = {}
            const other_participants_black_lists: Record<Participant.Uuid, number> = {}
            for (const other_giver_data of this.#giver_datas) {
                // Other giver
                other_giver_data.give_to_filtered_sorted.unshift(participant.uuid)
                other_giver_data.give_to_scores[participant.uuid] = new GiveToScore()
                other_giver_data.give_to_black_list_count[participant.uuid] = 0
                // Added participant
                other_participants.unshift(other_giver_data.uuid)
                other_participants_scores[other_giver_data.uuid] = new GiveToScore()
                other_participants_black_lists[other_giver_data.uuid] = 0
            }
            this.#giver_datas.push({
                uuid: participant.uuid,
                give_to_filtered_sorted: other_participants,
                give_to_scores: other_participants_scores,
                give_to_black_list_count: other_participants_black_lists,
                linked_to: {},
            })
            participant.addEventListener('delete', () => { this.#participant_remove(participant) })
        }
        #participant_remove(participant: Participant.Participant) {
            this.#giver_datas.splice(this.#giver_datas.findIndex(a_giver => a_giver.uuid == participant.uuid), 1)
            for (const another_giver of this.#giver_datas) {
                // Delete from array
                const participant_index = another_giver.give_to_filtered_sorted.findIndex(a_uuid => a_uuid == participant.uuid)
                if (participant_index >= 0)
                    another_giver.give_to_filtered_sorted.splice(participant_index, 1)
                // Delete from score record
                delete another_giver.give_to_scores[participant.uuid]
                // Delete from black lists record
                delete another_giver.give_to_black_list_count[participant.uuid]
            }
        }
        #group_add(group: Group.GroupType) {
            switch (group.type_key) {
                case 'mutual_exclusion':
                case 'one_way_exclusion':
                    const exclusion_group = group as Group.ExclusionGroupType
                    let participants_from = exclusion_group.get_exclusion_from()
                    let participants_to = exclusion_group.get_exclusion_to()
                    this.#insert_participants_exclusions(participants_from, participants_to)
                    group.addEventListener('update', () => {
                        this.#remove_participants_exclusions(participants_from, participants_to)
                        participants_from = exclusion_group.get_exclusion_from()
                        participants_to = exclusion_group.get_exclusion_to()
                        this.#insert_participants_exclusions(participants_from, participants_to)
                    })
                    group.addEventListener('delete', () => {
                        this.#remove_participants_exclusions(participants_from, participants_to)
                    })
                    break;

                case 'linked':
                    const linked_group = group as Group.Linked
                    let linked_participants = linked_group.get_linked_participants()
                    this.#insert_participants_linked(linked_participants)
                    linked_group.addEventListener('update', () => {
                        this.#remove_participants_linked(linked_participants)
                        linked_participants = linked_group.get_linked_participants()
                        this.#insert_participants_linked(linked_participants)
                    })
                    linked_group.addEventListener('delete', () => {
                        this.#remove_participants_linked(linked_participants)
                    })
                    break;

                default:
                    throw new Error(`Not implemented group type: ${group.type_key}`)
            }

        }
        #insert_participants_exclusions(participants_from: Array<Participant.Uuid>, participants_to: Array<Participant.Uuid>) {
            for (const excluded_from_uuid of participants_from) {
                const from_giver = this.#giver_datas.find(a_giver => a_giver.uuid == excluded_from_uuid)!
                for (const excluded_to_uuid of participants_to) {
                    if (excluded_from_uuid == excluded_to_uuid) continue;
                    const previous_black_list_count = from_giver.give_to_black_list_count[excluded_to_uuid] || 0
                    from_giver.give_to_black_list_count[excluded_to_uuid] = previous_black_list_count + 1
                    if (previous_black_list_count == 0)
                        from_giver.give_to_filtered_sorted.splice(from_giver.give_to_filtered_sorted.findIndex(a_uuid => a_uuid == excluded_to_uuid), 1)
                }
            }
        }
        #remove_participants_exclusions(participants_from: Array<Participant.Uuid>, participants_to: Array<Participant.Uuid>) {
            for (const excluded_from_uuid of participants_from) {
                const from_giver = this.#giver_datas.find(a_giver => a_giver.uuid == excluded_from_uuid)!
                for (const excluded_to_uuid of participants_to) {
                    const new_black_list_count = --from_giver.give_to_black_list_count[excluded_to_uuid]
                    if (new_black_list_count == 0) {
                        this.#sorted_insert_give_to(from_giver, excluded_to_uuid)
                    }
                }
            }
        }
        #insert_participants_linked(linked_participants: Array<Participant.Uuid>) {
            for (const the_uuid of linked_participants) {
                const the_giver = this.#giver_datas.find(a_giver => a_giver.uuid == the_uuid)!
                for (const another_linked_uuid of linked_participants) {
                    if (another_linked_uuid == the_uuid) continue;
                    the_giver.linked_to[another_linked_uuid] = (the_giver.linked_to[another_linked_uuid] || 0) + 1
                }
            }
        }
        #remove_participants_linked(linked_participants: Array<Participant.Uuid>) {
            for (const the_uuid of linked_participants) {
                const the_giver = this.#giver_datas.find(a_giver => a_giver.uuid == the_uuid)!
                for (const another_linked_uuid of linked_participants) {
                    if (another_linked_uuid == the_uuid) continue;
                    if (--the_giver.linked_to[another_linked_uuid] == 0)
                        delete the_giver.linked_to[another_linked_uuid]
                }
            }
        }
        #compute_exchange_score(exchange_year: number): number {
            return 1 / (2 ** (this.#exchange_score_ref_year - exchange_year))
        }
        #exchange_add(exchange: History.ExchangeData) {
            const from_giver = this.#giver_datas.find(a_giver => a_giver.uuid == exchange.from_uuid)!
            from_giver.give_to_scores[exchange.to_uuid].add(exchange.uuid, this.#compute_exchange_score(exchange.year))
            this.#sort_give_to(from_giver, exchange.to_uuid)
        }
        #exchange_edited(exchange: History.ExchangeData) {
            const new_exchange_score = this.#compute_exchange_score(exchange.year)
            for (const a_giver of this.#giver_datas)
                for (const to_score of Object.values(a_giver.give_to_scores))
                    if (to_score.update(exchange.uuid, new_exchange_score))
                        return;
        }
        #exchange_delete(exchange_uuid: History.Uuid) {
            for (const a_giver of this.#giver_datas)
                for (const to_score of Object.values(a_giver.give_to_scores))
                    if (to_score.remove(exchange_uuid))
                        return;
        }
        #sort_give_to(from_giver: GiverData, to_uuid: Participant.Uuid) {
            const found_index = from_giver.give_to_filtered_sorted.findIndex(a_uuid => a_uuid == to_uuid)
            if (found_index < 0) return; // Currently excluded

            // Remove to insert elsewere
            from_giver.give_to_filtered_sorted.splice(found_index, 1)

            // Insert back
            from_giver.give_to_filtered_sorted.splice( // Insert at index
                from_giver.give_to_filtered_sorted.findIndex(next_uuid => {
                    return from_giver.give_to_scores[to_uuid].value <= from_giver.give_to_scores[next_uuid].value
                }),
                0,
                to_uuid
            )
        }
        #sorted_insert_give_to(from_giver: GiverData, to_uuid: Participant.Uuid) {
            if (from_giver.give_to_filtered_sorted.findIndex(a_uuid => a_uuid == to_uuid) >= 0)
                throw new Error(`Found "give to" but it was expected excluded`)

            // Insert
            from_giver.give_to_filtered_sorted.splice( // Insert at index
                from_giver.give_to_filtered_sorted.findIndex(next_uuid => {
                    return from_giver.give_to_scores[to_uuid].value <= from_giver.give_to_scores[next_uuid].value
                }),
                0,
                to_uuid
            )
        }
        #update_exchange_score_ref_year(new_ref: number) {
            const year_offset = new_ref - this.#exchange_score_ref_year
            const update_ratio = 2 ** -year_offset

            for (const a_giver of this.#giver_datas)
                for (const to_uuid in a_giver.give_to_scores)
                    a_giver.give_to_scores[to_uuid].multiply(update_ratio)

            this.#exchange_score_ref_year = new_ref
        }

        static #find_arrangement(giver_data: Array<GiverData>, no_two_loop: boolean, max_gift_number: number, participant: Participant.Editor): Array<{ from: Participant.Uuid, to: Participant.Uuid }> {
            class WorkGiver {
                static link_record: Record<Participant.Uuid, WorkGiver> = {}
                #uuid: Participant.Uuid
                #sorted_possible_receiver: Array<{ give_to: boolean, receiver: WorkGiver }>
                #linked_with: Set<WorkGiver>
                give_count: number
                receive_count: number

                #init_possible_receiver_uuid: Array<Participant.Uuid>
                #init_linked_uuid: Array<Participant.Uuid>

                constructor(data: GiverData) {
                    this.#uuid = data.uuid
                    this.#sorted_possible_receiver = []
                    this.#linked_with = new Set()
                    this.give_count = 0
                    this.receive_count = 0

                    this.#init_possible_receiver_uuid = data.give_to_filtered_sorted
                    this.#init_linked_uuid = Object.entries(data.linked_to).map(key_value => key_value[0])

                    WorkGiver.link_record[this.#uuid] = this
                }

                static init() {
                    for (const [, giver] of Object.entries(this.link_record))
                        giver.#on_init()
                }
                #on_init() {
                    for (const other_uuid of this.#init_possible_receiver_uuid)
                        this.#sorted_possible_receiver.push({ give_to: false, receiver: WorkGiver.link_record[other_uuid] })
                    for (const other_uuid of this.#init_linked_uuid)
                        this.#linked_with.add(WorkGiver.link_record[other_uuid])
                }

                get_possible_receiver_left_count() {
                    return this.#sorted_possible_receiver
                        .reduce(
                            (count, value) => count + (value.give_to ? 0 : 1),
                            0
                        )
                }
                get_sorted_receiver_left() {
                    return this.#sorted_possible_receiver
                        .filter(value => !value.give_to && value.receiver.receive_count < max_gift_number)
                }
                does_give_to(other: WorkGiver): boolean { return this.#sorted_possible_receiver.some(value => value.give_to && value.receiver == other) }

                get uuid() { return this.#uuid }
                get_result_receivers(): Array<Participant.Uuid> {
                    return this.#sorted_possible_receiver
                        .filter(value => value.give_to)
                        .map(value => value.receiver.#uuid)
                }
            }

            const work_givers = giver_data.map(giver_data => new WorkGiver(giver_data))
            WorkGiver.init()
            work_givers.sort((before, after) => before.get_possible_receiver_left_count() - after.get_possible_receiver_left_count())

            const TOTAL_MAX_GIFT_NUMBER: number = max_gift_number * work_givers.length
            let current_gift_number = 0

            { // Error prevention
                if (work_givers.length - 1 < max_gift_number) {
                    throw ArrangementError(`Vous demandez d'offrir plus de cadeaux (${max_gift_number}) qu'il y a d'autres participants (${work_givers.length} - 1).`)
                }
                if (no_two_loop && work_givers.length - 1 < max_gift_number * 2) {
                    throw ArrangementError(`Vous demandez d'offrir et recevoir plus de cadeaux (${max_gift_number * 2}) qu'il y a d'autres participants (${work_givers.length} - 1). Diminuez le nombre de cadeau ou autorizez les boucles de deux.`)
                }
                for (const a_participant of work_givers) {
                    const a_participant_name = participant.get_participant_by_uuid(a_participant.uuid)?.name
                    const givable: Set<Participant.Uuid> = new Set(a_participant.get_sorted_receiver_left().map(value => value.receiver.uuid))
                    const receivable: Set<Participant.Uuid> = new Set(work_givers.filter(giver => giver.get_sorted_receiver_left().map(value => value.receiver).includes(a_participant)).map(giver => giver.uuid))

                    if (givable.size == 0) {
                        throw ArrangementError(`<b>${a_participant_name}</b> ne peut offrir de cadeaux à personne. Regardez les groupes d'exclusion à sens unique et/ou mutuelles.`)
                    }
                    if (receivable.size == 0) {
                        throw ArrangementError(`Personne ne peut offir de cadeau à <b>${a_participant_name}</b>. Regardez les groupes d'exclusion à sens unique et/ou mutuelles.`)
                    }
                    if (givable.size < max_gift_number) {
                        throw ArrangementError(`<b>${a_participant_name}</b> ne peut offir de cadeaux qu'à ${givable.size} personnes, moins que le nombre de cadeaux par personne (${max_gift_number}). Regardez les groupes d'exclusion à sens unique et/ou mutuelles.`)
                    }
                    if (receivable.size < max_gift_number) {
                        throw ArrangementError(`<b>${a_participant_name}</b> ne peut recevoir de la part cadeaux que de la part de ${receivable.size} personnes, moins que le nombre de cadeaux par personne (${max_gift_number}). Regardez les groupes d'exclusion à sens unique et/ou mutuelles.`)
                    }

                    if (no_two_loop) {
                        const givable_or_receivable: Set<Participant.Uuid> = new Set([...givable, ...receivable])

                        if (givable_or_receivable.size < max_gift_number * 2) {
                            throw ArrangementError(`<b>${a_participant_name}</b> ne peut offir et/ou recevoir de cadeaux seulement avec ${givable_or_receivable.size} personnes, moins que le double du nombre de cadeaux par personne (${max_gift_number * 2}). L'option "Pas de boucle de deux" empèche d'offrir un cadeau à quelqu'un qui vous en offre un. Regardez les groupes d'exclusion à sens unique et/ou mutuelles.`)
                        }
                    }
                }
            }

            /**
             * Recursively search for a valid arrangement.
             * 
             * @returns true if an arrangement was found.
             */
            function recursive_find_arrangement(): boolean {
                for (const giver of work_givers) {
                    if (giver.give_count == max_gift_number) continue;
                    if (giver.give_count > max_gift_number) throw new Error(`give_count too high`);
                    giver.give_count++
                    for (const receiver of giver.get_sorted_receiver_left()) {
                        if (no_two_loop && receiver.receiver.does_give_to(giver)) continue; // No direct loop back

                        receiver.give_to = true
                        receiver.receiver.receive_count++
                        current_gift_number++

                        if (current_gift_number == TOTAL_MAX_GIFT_NUMBER || recursive_find_arrangement())
                            return true

                        receiver.give_to = false
                        receiver.receiver.receive_count--
                        current_gift_number--
                    }
                    giver.give_count--
                }

                return false
            }
            if (!recursive_find_arrangement()) {
                throw ArrangementError(`Aucun arrangement n'est possible avec les contriantes données. Diminuez ne nombre de cadeaux, autorisez les boucles de deux ou retirer des exclusions.`)
            }

            return work_givers.map(giver => giver.get_result_receivers().map(receiver_uuid => ({ from: giver.uuid, to: receiver_uuid }))).flat()
        }

        #control_generate() {
            try {
                this.#error_box.clear()
                this.#set_result(Editor.#find_arrangement(
                    this.#giver_datas,
                    this.#avoid_two_loop.checked,
                    this.#gift_number.value,
                    this.#participant
                ))
                this.#root.dispatchEvent(new Event('update'))
            } catch (error) {
                if (is_arrangement_error(error as Error)) {
                    this.#error_box.set((error as ArrangementError).message)
                } else
                    throw error
            }
        }

        #add_result_exchange(from?: Participant.Uuid, to?: Participant.Uuid) {
            const from_picker = this.#participant.participant_picker_factory('from', undefined, '▾ Offreu·r·se ▾', from)
            const to_picker = this.#participant.participant_picker_factory('to', undefined, '▾ Receveu·r·se ▾', to)
            const delete_button = element_factory('button', { type: 'button' }, svg_factory('/img/Delete.svg'))

            const elem = element_factory('div', { class: 'exchange' }, [
                from_picker,
                svg_factory('/img/Arrow right.svg'),
                to_picker,
                delete_button,
            ])

            // Events
            const picker_change_handler = () => {
                if (from_picker.value == to_picker.value || !this.#giver_datas.find(giver => giver.uuid == from_picker.value)?.give_to_filtered_sorted.includes(to_picker.value))
                    elem.setAttribute('from_equal_to', '')
                else
                    elem.removeAttribute('from_equal_to')
                this.#root.dispatchEvent(new Event('update'))
            }
            const remove_exchange = () => {
                elem.remove()
                this.#root.dispatchEvent(new Event('update'))
            }
            const picker_selected_got_deleted_handler = () => {
                if (!from_picker.selectedOptions[0].getAttribute('value') && !to_picker.selectedOptions[0].getAttribute('value'))
                    remove_exchange()
            }
            from_picker.addEventListener('change', picker_change_handler)
            to_picker.addEventListener('change', picker_change_handler)
            from_picker.addEventListener('participant_update', picker_selected_got_deleted_handler)
            to_picker.addEventListener('participant_update', picker_selected_got_deleted_handler)
            delete_button.addEventListener('click', remove_exchange, { once: true })

            this.#next_exchanges_container.insertAdjacentElement('beforeend', elem)
        }
        static #exchange_to_uuid(exchange: HTMLElement, by: 'from' | 'to'): Participant.Uuid | null {
            const select = (exchange.querySelector(`select[name="${by}"]`) as HTMLSelectElement | null)
            if (select === null)
                return null
            else
                return select.selectedOptions[0].getAttribute('value')
        }
        #sort_result_exchange(by: 'from' | 'to') {
            const exchange_to_name = (elem: HTMLElement): string => {
                const uuid: Participant.Uuid | null = Editor.#exchange_to_uuid(elem, by)
                if (uuid === null)
                    return ''
                else
                    return this.#participant.get_participant_by_uuid(uuid)!.name
            }
            Array.from(this.#next_exchanges_container.children).sort((elem_a, elem_b) => exchange_to_name(elem_a as HTMLElement).localeCompare(exchange_to_name(elem_b as HTMLElement))).forEach(elem => this.#next_exchanges_container.appendChild(elem))
        }
        #set_result(exchanges: Array<{ from: Participant.Uuid, to: Participant.Uuid }>) {
            this.#next_exchanges_container.innerHTML = ''
            for (const exchange of exchanges)
                this.#add_result_exchange(exchange.from, exchange.to)
        }
        get_result(): Array<{ from: Participant.Uuid, to: Participant.Uuid }> {
            return Array.from(this.#next_exchanges_container.children)
                .map(exchange_elem => ({
                    from: Editor.#exchange_to_uuid(exchange_elem as HTMLElement, 'from'),
                    to: Editor.#exchange_to_uuid(exchange_elem as HTMLElement, 'to'),
                }))
                .filter(exchange => exchange.from && exchange.to) as Array<{ from: Participant.Uuid, to: Participant.Uuid }>
        }

        #copy_result_abstract() {
            const abstract: string = this.get_result().map(exchange => `${this.#participant.get_participant_by_uuid(exchange.from)?.name} → ${this.#participant.get_participant_by_uuid(exchange.to)?.name}`).join(',\n')
            navigator.clipboard.writeText(abstract)
        }
        #download_result_year() {
            const csv_content = ['"Offreu·r·se","Receveu·r·se"'].concat(
                this.get_result().map(
                    exchange => `"${this.#participant.get_participant_by_uuid(exchange.from)?.name}","${this.#participant.get_participant_by_uuid(exchange.to)?.name}"`)
            ).join('\n')
            const blob_csv = new Blob([csv_content], { type: 'text/plain;charset=utf-8' })
            FileSaver.saveAs(blob_csv, `Distribution Noël ${this.#year.value}.csv`, { autoBom: true })
        }
        #download_result_with_history() {
            const next_year: number = this.#year.value
            const future_raw_data: RawData.Agregation = RawData.get_raw_data(this.#participant, this.#history, this.#group, this)
            future_raw_data.next.result.forEach(next_exchange => {
                future_raw_data.history.push({
                    uuid: uuid(),
                    from_uuid: next_exchange.from,
                    to_uuid: next_exchange.to,
                    year: next_year,
                })
            })
            future_raw_data.next.result = []
            future_raw_data.next.control.year = next_year + 1

            const for_next_year_blob = new Blob([JSON.stringify(future_raw_data)], { type: 'text/plain;charset=utf-8' })
            FileSaver.saveAs(for_next_year_blob, `Historique jusqu'à ${next_year}.noel`, { autoBom: true })
        }

        get_raw_data(): NextRawData {
            return {
                control: {
                    year: this.#year.value_is_set() ? this.#year.value : undefined,
                    gift_number: this.#gift_number.value_is_set() ? this.#gift_number.value : undefined,
                    no_two_loop: this.#avoid_two_loop.checked,
                },
                result: this.get_result(),
            }
        }
        set_from_raw_data(raw_data: NextRawData) {
            // Controls
            if (raw_data.control.year !== undefined) {
                this.#year.value = raw_data.control.year
                this.#exchange_score_ref_year = raw_data.control.year
            }
            if (raw_data.control.gift_number !== undefined) {
                this.#gift_number.value = raw_data.control.gift_number
            }
            this.#avoid_two_loop.checked = raw_data.control.no_two_loop
            // Results
            this.#set_result(raw_data.result)
            // Inner values
            this.#giver_datas = []
            for (const a_participant of this.#participant.participant_list)
                this.#participant_add(a_participant)
            for (const a_group of this.#group.get_groups())
                this.#group_add(a_group)
            for (const a_exchange of this.#history.get_exchanges())
                this.#exchange_add(a_exchange)
        }
    }

} // namespace Next

export namespace RawData { // Raw data storage
    export type Agregation = {
        participants: Participant.ParticipantListRawData
        history: History.HistoryRawData
        groups: Group.GroupListRawData
        next: Next.NextRawData
    }

    export function get_raw_data(participant: Participant.Editor, history: History.Editor, group: Group.Editor, next: Next.Editor): Agregation {
        return {
            participants: participant.get_raw_data(),
            history: history.get_raw_data(),
            groups: group.get_raw_data(),
            next: next.get_raw_data(),
        }
    }
    export function set_raw_data(raw_data: Agregation, participant: Participant.Editor, history: History.Editor, group: Group.Editor, next: Next.Editor) {
        participant.set_from_raw_data(raw_data.participants)
        history.set_from_raw_data(raw_data.history)
        group.set_from_raw_data(raw_data.groups)
        next.set_from_raw_data(raw_data.next)
    }
}
