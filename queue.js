class Queue {
    constructor() {
        this.queue = [];
    }

    enqueue(val) {
        this.queue.push(val);
    }

    dequeue() {
        return this.queue.shift(); // Return the dequeued value
    }

    view() {
        console.log(this.queue);
    }
}

module.exports = Queue;
